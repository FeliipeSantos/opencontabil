import { Button, Flex, Modal, Skeleton, Tag } from 'antd';
import { Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import styled from 'styled-components';

import { errorMessage } from '@/core/api/client';
import { useLoad } from '@/core/hooks/useLoad';
import { ErrorState } from '@/core/ui';
import { AiAnalysisPanel, type AiPanelApi } from '@/modules/intelligence/components/AiSummaryTab';
import { reformaApi } from '@/modules/reforma/api';
import { HintBadge } from '@/modules/reforma/components/HintBadge';
import { currentVersionReason, FILE_STATUS, formatDate, formatDateTime, VERSION_HINTS } from '@/modules/reforma/format';
import type { DocumentVersion } from '@/modules/reforma/types';
import { colors, fontSize, radius } from '@/theme';

const Meta = styled.span`
  font-size: ${fontSize.label}px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: ${colors.textSubtle};
`;

const Title = styled.h3`
  margin: 0;
  font-size: ${fontSize.section}px;
  font-weight: 600;
  color: ${colors.navy};
  line-height: 1.35;
  overflow-wrap: anywhere;
`;

const Versions = styled.ol`
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
`;

const Version = styled.li<{ $current: boolean }>`
  padding: 12px 14px;
  border: 1px solid ${colors.border};
  border-left: 3px solid ${({ $current }) => ($current ? colors.blue : colors.borderStrong)};
  border-radius: ${radius.card}px;
  background: ${colors.bgCard};
`;

const VersionHead = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: ${fontSize.support}px;
  font-weight: 500;
  color: ${colors.navy};
`;

const Small = styled.p`
  margin: 4px 0 0;
  font-size: 12px;
  color: ${colors.textMuted};
  overflow-wrap: anywhere;
`;

const Summary = styled.p`
  margin: 6px 0 0;
  font-size: ${fontSize.support}px;
  line-height: 1.5;
  color: ${colors.textDark};
  overflow-wrap: anywhere;
`;

const TextBox = styled.div`
  margin-top: 8px;
  max-height: 40vh;
  overflow-y: auto;
  padding: 12px 14px;
  border: 1px solid ${colors.border};
  border-radius: ${radius.card}px;
  background: ${colors.bgSubtle};
  font-size: ${fontSize.support}px;
  line-height: 1.6;
  white-space: pre-line;
  overflow-wrap: anywhere;
  color: ${colors.textDark};
`;

function VersionText({ documentId, version }: { documentId: string; version: DocumentVersion }) {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!version.textLength) return <Small>Sem texto completo guardado para esta versão.</Small>;
  if (text !== null) return <TextBox>{text || 'Texto vazio.'}</TextBox>;
  return (
    <>
      <Button
        size="small"
        loading={loading}
        onClick={() => {
          setLoading(true);
          reformaApi
            .versionText(documentId, version.id)
            .then(setText)
            .catch((err) => setError(errorMessage(err)))
            .finally(() => setLoading(false));
        }}
      >
        Ver texto ({version.textLength.toLocaleString('pt-BR')} caracteres)
      </Button>
      {error && <Small>{error}</Small>}
    </>
  );
}

const Actions = styled(Flex)`
  margin-top: 8px;
`;

const AnalysisBox = styled.div`
  margin-top: 10px;
  padding: 14px 16px;
  border: 1px solid ${colors.border};
  border-radius: ${radius.card}px;
  background: ${colors.bgSubtle};
`;

/** "Análise IA" of a version: opened on click; the AI runs only when "Gerar" is clicked inside. */
function VersionAnalysis({ documentId, versionId, open }: { documentId: string; versionId: string; open: boolean }) {
  const api = useMemo<AiPanelApi>(
    () => ({ get: () => reformaApi.versionAnalysis(documentId, versionId), request: () => reformaApi.requestVersionAnalysis(documentId, versionId) }),
    [documentId, versionId],
  );
  if (!open) return null;
  return (
    <AnalysisBox>
      <AiAnalysisPanel api={api} kind="analise" />
    </AnalysisBox>
  );
}

interface DocumentModalProps {
  documentId: string | null;
  sourceName: (id: string) => string;
  kindName: (id: string) => string;
  onClose: () => void;
}

/** One document: where it came from and every version detected, newest first. */
export function DocumentModal({ documentId, sourceName, kindName, onClose }: DocumentModalProps) {
  const state = useLoad(() => (documentId ? reformaApi.document(documentId) : Promise.resolve(undefined)), [documentId]);
  const doc = state.data;
  // versões com a Análise IA aberta
  const [openAnalyses, setOpenAnalyses] = useState<Set<string>>(() => new Set());
  const toggleAnalysis = (id: string) =>
    setOpenAnalyses((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Modal
      open={documentId !== null}
      onCancel={onClose}
      centered
      width={760}
      destroyOnHidden
      title={doc ? <Meta>{sourceName(doc.sourceId)}</Meta> : null}
      styles={{
        body: {
          maxHeight: 'calc(100vh - 200px)',
          overflowY: 'auto',
          paddingRight: 4,
        },
      }}
      footer={
        doc ? (
          <Button type="primary" href={doc.url} target="_blank" rel="noopener noreferrer">
            Abrir fonte oficial ↗
          </Button>
        ) : null
      }
    >
      {state.error ? (
        <ErrorState message={state.error} onRetry={state.reload} />
      ) : !doc ? (
        <Skeleton active />
      ) : (
        <Flex vertical gap={14}>
          <Title>{doc.title}</Title>
          <Flex wrap gap={6} align="center">
            <Tag>{kindName(doc.kind)}</Tag>
            {doc.sourceStatus && <Tag>{doc.sourceStatus}</Tag>}
            <Small>
              Publicado em {formatDate(doc.publishedAt)} · visto pela primeira vez em {formatDateTime(doc.firstSeenAt)} · última verificação {formatDateTime(doc.lastCheckedAt)}
            </Small>
          </Flex>
          <Meta>Histórico de versões ({doc.versions.length})</Meta>
          <Versions>
            {doc.versions.map((version, index) => {
              const file = FILE_STATUS[version.fileStatus];
              return (
                <Version key={version.id} $current={index === 0}>
                  <VersionHead>
                    {version.label ?? 'Versão'}
                    {index === 0 && <HintBadge tone="info" label="Atual" heading="Versão atual" what={VERSION_HINTS.current} why={currentVersionReason(doc.versions.length)} />}
                    {file && <HintBadge tone={file.tone} label={file.label} what={file.hint} />}
                    {version.analysisStatus === 'done' ? (
                      <HintBadge tone="success" label="Analisada por IA" what={VERSION_HINTS.analysisDone} />
                    ) : (
                      <HintBadge tone="neutral" label="Sem análise IA" what={VERSION_HINTS.pendingAnalysis} />
                    )}
                  </VersionHead>
                  <Small>
                    Detectada em {formatDateTime(version.detectedAt)}
                    {version.publishedAt ? ` · publicada em ${formatDate(version.publishedAt)}` : ''}
                    {version.fileError ? ` · ${version.fileError}` : ''}
                  </Small>
                  {version.summary && <Summary>{version.summary}</Summary>}
                  {version.fileUrl && (
                    <Small>
                      <a href={version.fileUrl} target="_blank" rel="noopener noreferrer">
                        Arquivo oficial desta versão ↗
                      </a>
                    </Small>
                  )}
                  <Actions gap={8} wrap align="flex-start">
                    <VersionText documentId={doc.id} version={version} />
                    <Button size="small" icon={<Sparkles size={13} aria-hidden />} onClick={() => toggleAnalysis(version.id)} aria-expanded={openAnalyses.has(version.id)}>
                      {openAnalyses.has(version.id) ? 'Fechar análise IA' : 'Análise IA'}
                    </Button>
                  </Actions>
                  <VersionAnalysis documentId={doc.id} versionId={version.id} open={openAnalyses.has(version.id)} />
                </Version>
              );
            })}
          </Versions>
        </Flex>
      )}
    </Modal>
  );
}
