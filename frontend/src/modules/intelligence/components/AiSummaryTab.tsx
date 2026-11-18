import { Alert, Button, Flex, Spin, Tag, Tooltip } from 'antd';
import { Sparkles } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';

import { apiRequest, errorMessage } from '@/core/api/client';
import { SETTINGS_PATH } from '@/core/settings/routes';
import { formatDate, formatDateTime } from '@/modules/intelligence/format';
import { colors, fontSize, radius } from '@/theme';

interface AiPoint {
  texto: string;
  /** "fonte": written in the official text (with the exact excerpt); "contexto": general knowledge of the AI. */
  origem: 'fonte' | 'contexto';
  trecho: string;
}

interface AiDeadline {
  data: string;
  descricao: string;
  origem: 'fonte' | 'contexto';
  trecho: string;
}

interface AiSummary {
  tipo: 'norma' | 'proposta' | 'comunicado' | 'documento_tecnico' | 'outro';
  do_que_se_trata: string;
  quem_e_afetado: AiPoint[];
  quem_nao_e_afetado: AiPoint[];
  o_que_muda: AiPoint[];
  o_que_fazer: AiPoint[];
  prazos: AiDeadline[];
  vigencia: AiPoint | null;
  confianca: 'alta' | 'media' | 'baixa';
  motivo_confianca: string;
  informacoes_faltando: string[];
}

export interface AiSummaryState {
  status: 'none' | 'pending' | 'ok' | 'error';
  provider?: string;
  providerName?: string;
  /** "key": made with the free Gemini key, not a subscription. */
  providerKind?: 'cli' | 'key';
  model?: string | null;
  summary?: AiSummary | null;
  partial?: boolean;
  error?: string | null;
  updatedAt?: string;
  /** The official text changed after this summary. */
  outdated?: boolean;
}

const path = (id: string) => `/api/intelligence/publications/${encodeURIComponent(id)}/ai-summary`;
const aiSummaryApi = {
  get: (id: string) => apiRequest<AiSummaryState>(path(id)),
  request: (id: string) => apiRequest<AiSummaryState>(path(id), { method: 'POST' }),
};

const POLL_MS = 3000;

/** Where the panel reads and asks for the AI text: a publication or a Calendário version. */
export interface AiPanelApi {
  get: () => Promise<AiSummaryState>;
  request: () => Promise<AiSummaryState>;
}

type PanelKind = 'resumo' | 'analise';

const TEXTS: Record<PanelKind, { intro: string; action: string; failed: string; reading: string; outdated: string }> = {
  resumo: {
    intro: 'Peça um resumo desta publicação à IA conectada em Ajustes > Integrações. Ele fica salvo para as próximas vezes.',
    action: 'Gerar resumo com IA',
    failed: 'Não foi possível gerar o resumo.',
    reading: 'está lendo a publicação',
    outdated: 'O texto da publicação mudou depois deste resumo. Gere de novo para atualizar.',
  },
  analise: {
    intro:
      'Peça a análise desta versão à IA conectada em Ajustes > Integrações: impacto, quem é afetado e o que fazer. Ela só é feita quando você pede e fica salva para as próximas vezes.',
    action: 'Gerar análise com IA',
    failed: 'Não foi possível gerar a análise.',
    reading: 'está lendo o documento',
    outdated: 'O texto desta versão mudou depois desta análise. Gere de novo para atualizar.',
  },
};

const KIND: Record<AiSummary['tipo'], string> = {
  norma: 'Norma',
  proposta: 'Proposta',
  comunicado: 'Comunicado',
  documento_tecnico: 'Documento técnico',
  outro: 'Outro',
};

// o que cada nível quer dizer (mostrado ao passar o mouse, junto do motivo dado pela IA)
const CONFIDENCE: Record<AiSummary['confianca'], { label: string; color: string; meaning: string }> = {
  alta: {
    label: 'Confiança alta',
    color: 'green',
    meaning: 'O texto enviado à IA traz as regras, quem é afetado e os prazos; quase tudo no resumo sai do próprio texto oficial.',
  },
  media: {
    label: 'Confiança média',
    color: 'gold',
    meaning: 'O texto cobre o principal, mas falta algum detalhe; parte do resumo vem do conhecimento geral da IA.',
  },
  baixa: {
    label: 'Confiança baixa',
    color: 'red',
    meaning:
      'O texto disponível é curto ou incompleto (por exemplo, só a notícia, sem o ato oficial); boa parte do resumo vem do conhecimento geral da IA. Confira na fonte oficial.',
  },
};

/** How many points of the summary come from the official text ("fonte") out of all points. */
function pointsFromSource(summary: Pick<AiSummary, 'quem_e_afetado' | 'quem_nao_e_afetado' | 'o_que_muda' | 'o_que_fazer' | 'prazos' | 'vigencia'>) {
  const points = [
    ...summary.quem_e_afetado,
    ...summary.quem_nao_e_afetado,
    ...summary.o_que_muda,
    ...summary.o_que_fazer,
    ...summary.prazos,
    ...(summary.vigencia ? [summary.vigencia] : []),
  ];
  return { fromSource: points.filter((p) => p.origem === 'fonte').length, total: points.length };
}

const ConfidenceTag = styled(Tag)`
  cursor: help;
`;

const ConfidenceTip = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12.5px;
  line-height: 1.45;

  strong {
    font-weight: 600;
  }
`;

const Box = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const Empty = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  padding: 20px;
  border: 1px dashed ${colors.borderStrong};
  border-radius: ${radius.card}px;
  font-size: ${fontSize.support}px;
  color: ${colors.textMuted};
`;

const Lead = styled.p`
  margin: 0;
  padding: 14px 16px;
  border-radius: ${radius.card}px;
  background: ${colors.blueSelected};
  font-size: 14.5px;
  line-height: 1.55;
  color: ${colors.textDark};
`;

const Section = styled.section`
  h4 {
    margin: 0 0 8px;
    font-size: ${fontSize.support}px;
    font-weight: 600;
    color: ${colors.navy};
  }

  ul {
    margin: 0;
    padding-left: 18px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  li {
    font-size: ${fontSize.support}px;
    line-height: 1.55;
    color: ${colors.textDark};
  }
`;

const Origin = styled(Tag)`
  &&& {
    margin-left: 6px;
    font-size: 11px;
    line-height: 18px;
    cursor: default;
  }
`;

const Footer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-top: 12px;
  border-top: 1px solid ${colors.border};
  font-size: 12px;
  color: ${colors.textSubtle};
`;

function OriginTag({ point }: { point: { origem: 'fonte' | 'contexto'; trecho: string } }) {
  if (point.origem === 'fonte') {
    return (
      <Tooltip title={`“${point.trecho}”`}>
        <Origin color="blue">Do texto oficial</Origin>
      </Tooltip>
    );
  }
  return (
    <Tooltip title="Conhecimento geral da IA, não está no texto da publicação. Confira antes de usar.">
      <Origin>Contexto da IA</Origin>
    </Tooltip>
  );
}

function Points({ title, points }: { title: string; points: AiPoint[] }) {
  if (!points.length) return null;
  return (
    <Section>
      <h4>{title}</h4>
      <ul>
        {points.map((point, index) => (
          <li key={index}>
            {point.texto}
            <OriginTag point={point} />
          </li>
        ))}
      </ul>
    </Section>
  );
}

function SummaryView({ state, kind }: { state: AiSummaryState & { summary: AiSummary }; kind: PanelKind }) {
  const { summary } = state;
  const confidence = CONFIDENCE[summary.confianca];
  const sources = pointsFromSource(summary);
  return (
    <Box>
      <Flex gap={6} wrap>
        <Tag>{KIND[summary.tipo]}</Tag>
        <Tooltip
          placement="bottomLeft"
          title={
            <ConfidenceTip>
              <span>{confidence.meaning}</span>
              {summary.motivo_confianca && (
                <span>
                  <strong>Neste resumo:</strong> {summary.motivo_confianca}
                </span>
              )}
              {sources.total > 0 && (
                <span>
                  {sources.fromSource} de {sources.total} {sources.total === 1 ? 'ponto vem' : 'pontos vêm'} do texto oficial; os demais são contexto da IA.
                </span>
              )}
            </ConfidenceTip>
          }
        >
          <ConfidenceTag color={confidence.color} tabIndex={0}>
            {confidence.label}
          </ConfidenceTag>
        </Tooltip>
      </Flex>
      {summary.do_que_se_trata && <Lead>{summary.do_que_se_trata}</Lead>}
      {state.outdated && <Alert type="warning" showIcon message={TEXTS[kind].outdated} />}
      {state.partial && <Alert type="info" showIcon message="O ato é muito longo: a IA recebeu só a primeira parte do texto oficial." />}
      <Points title="Quem é afetado" points={summary.quem_e_afetado} />
      <Points title="Quem não é afetado" points={summary.quem_nao_e_afetado} />
      <Points title="O que muda" points={summary.o_que_muda} />
      <Points title="O que fazer" points={summary.o_que_fazer} />
      {summary.prazos.length > 0 && (
        <Section>
          <h4>Prazos</h4>
          <ul>
            {summary.prazos.map((deadline, index) => (
              <li key={index}>
                {deadline.data && <strong>{formatDate(deadline.data)}: </strong>}
                {deadline.descricao}
                <OriginTag point={deadline} />
              </li>
            ))}
          </ul>
        </Section>
      )}
      {summary.vigencia && (
        <Section>
          <h4>Vigência</h4>
          <ul>
            <li>
              {summary.vigencia.texto}
              <OriginTag point={summary.vigencia} />
            </li>
          </ul>
        </Section>
      )}
      {summary.informacoes_faltando.length > 0 && (
        <Section>
          <h4>O que o texto não informa</h4>
          <ul>
            {summary.informacoes_faltando.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </Section>
      )}
      <Footer>
        {summary.motivo_confianca && <span>{summary.motivo_confianca}</span>}
        <span>
          Gerado pelo {state.providerName}
          {state.model ? ` (${state.model})` : ''} com a sua {state.providerKind === 'key' ? 'chave gratuita' : 'assinatura'}{state.updatedAt ? ` em ${formatDateTime(state.updatedAt)}` : ''}. A IA pode errar: confira
          sempre o texto oficial. Não constitui parecer jurídico ou contábil.
        </span>
      </Footer>
    </Box>
  );
}

/** "Resumo IA" tab of a publication. */
export function AiSummaryTab({ publicationId }: { publicationId: string }) {
  const api = useMemo<AiPanelApi>(() => ({ get: () => aiSummaryApi.get(publicationId), request: () => aiSummaryApi.request(publicationId) }), [publicationId]);
  return <AiAnalysisPanel api={api} kind="resumo" />;
}

/** AI text made only when asked, with the AI chosen in Ajustes > Integrações, and kept for the next openings. */
export function AiAnalysisPanel({ api, kind }: { api: AiPanelApi; kind: PanelKind }) {
  const texts = TEXTS[kind];
  const [state, setState] = useState<AiSummaryState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);

  const load = useCallback(() => {
    setLoadError(null);
    api
      .get()
      .then(setState)
      .catch((error) => setLoadError(errorMessage(error)));
  }, [api]);

  useEffect(load, [load]);

  // pedido em andamento: acompanha até ficar pronto
  const pending = state?.status === 'pending';
  useEffect(() => {
    if (!pending) return undefined;
    const timer = window.setInterval(() => {
      api
        .get()
        .then(setState)
        .catch(() => undefined);
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [pending, api]);

  async function generate() {
    setRequesting(true);
    setRequestError(null);
    try {
      setState(await api.request());
    } catch (error) {
      setRequestError(errorMessage(error));
    } finally {
      setRequesting(false);
    }
  }

  if (loadError) return <Alert type="error" showIcon message={loadError} action={<Button onClick={load}>Tentar de novo</Button>} />;
  if (!state) return <Spin />;

  const settingsLink = <Link to={`${SETTINGS_PATH}?aba=integracoes`}>Ajustes &gt; Integrações</Link>;
  const requestAlert = requestError && (
    <Alert
      type="warning"
      showIcon
      message={requestError}
      description={requestError.includes('Integrações') || requestError.includes('instalada') ? <>Abra {settingsLink} para conectar a IA.</> : undefined}
    />
  );

  if (state.status === 'pending') {
    return (
      <Empty>
        <Flex gap={10} align="center">
          <Spin size="small" />
          <span>
            {state.providerName ?? 'A IA'} {texts.reading}. Isso costuma levar menos de um minuto.
          </span>
        </Flex>
      </Empty>
    );
  }

  if (state.status === 'ok' && state.summary) {
    return (
      <Box>
        <SummaryView state={state as AiSummaryState & { summary: AiSummary }} kind={kind} />
        {requestAlert}
        <Flex>
          <Button onClick={() => void generate()} loading={requesting}>
            Gerar de novo
          </Button>
        </Flex>
      </Box>
    );
  }

  return (
    <Box>
      <Empty>
        <Flex gap={10} align="center">
          <Sparkles size={18} aria-hidden />
          <span>
            {state.status === 'error' ? texts.failed : texts.intro}
          </span>
        </Flex>
        {state.status === 'error' && state.error && <Alert type="error" showIcon message={state.error} />}
        <Button type="primary" onClick={() => void generate()} loading={requesting}>
          {state.status === 'error' ? 'Tentar de novo' : texts.action}
        </Button>
      </Empty>
      {requestAlert}
    </Box>
  );
}
