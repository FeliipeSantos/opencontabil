import { AppstoreOutlined } from '@ant-design/icons';
import { App, Switch } from 'antd';
import { useState } from 'react';
import styled from 'styled-components';

import { errorMessage, SessionExpiredError } from '@/core/api/client';
import { useModules } from '@/core/modules/modulesContext';
import { About, Panel, Row } from '@/core/settings/layout';
import { IconCircle } from '@/core/ui';
import { MODULE_GROUPS, MODULES } from '@/modules';
import { colors, radius } from '@/theme';

const ALWAYS_ON = 'overview';

/** What each module does, shown next to its switch. */
const DESCRIPTIONS: Record<string, string> = {
  clients: 'Cadastro dos clientes. Desligado, a lista continua disponível para Recebimentos e DAS.',
  receipts: 'Cobranças, recebimentos e saldos dos clientes.',
  das: 'Guias do DAS dos clientes MEI.',
  intelligence: 'Atualizações das fontes oficiais. Desligado, a coleta diária também para.',
  reforma: 'Prazos e documentos da legislação. Desligado, a sincronização diária também para.',
  projects: 'Status report dos projetos.',
};

const Groups = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const GroupTitle = styled.h3`
  margin: 0 0 8px;
  font-size: 12.5px;
  font-weight: 600;
  color: ${colors.textMuted};
`;

const List = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid ${colors.border};
  border-radius: ${radius.card}px;
  overflow: hidden;
`;

const Item = styled.li<{ $off: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: ${({ $off }) => ($off ? colors.bgSubtle : colors.bgCard)};

  & + & {
    border-top: 1px solid ${colors.border};
  }
`;

const ModuleIcon = styled.span<{ $off: boolean }>`
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 8px;
  border: 1px solid ${colors.border};
  background: ${colors.bgCard};
  color: ${({ $off }) => ($off ? colors.textSubtle : colors.blue)};
  font-size: 15px;
`;

const Texts = styled.label<{ $off: boolean }>`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  cursor: pointer;

  strong {
    font-size: 14px;
    font-weight: 600;
    color: ${({ $off }) => ($off ? colors.textMuted : colors.textDark)};
  }

  small {
    font-size: 12.5px;
    color: ${colors.textMuted};
  }
`;

// na ordem da navegação: os módulos de um grupo ficam juntos, sob o nome do grupo; os demais, sozinhos e sem título
function sections() {
  const result: { key: string; label: string | null; modules: typeof MODULES }[] = [];
  // a Visão Geral fica sempre ligada: não aparece aqui
  MODULES.filter((m) => m.key !== ALWAYS_ON).forEach((module) => {
    const group = MODULE_GROUPS.find((g) => g.key === module.group);
    const section = group && result.find((s) => s.key === group.key);
    if (section) section.modules.push(module);
    else result.push({ key: group?.key ?? module.key, label: group?.label ?? null, modules: [module] });
  });
  return result;
}

/** "Módulos" tab: turns the modules of the navigation on or off for the whole installation. */
export function ModulesSettings() {
  const { message } = App.useApp();
  const { disabled, isEnabled, save } = useModules();
  const [saving, setSaving] = useState<string | null>(null);

  async function toggle(key: string, label: string, on: boolean) {
    setSaving(key);
    try {
      await save(on ? disabled.filter((k) => k !== key) : [...disabled, key]);
      message.success(on ? `${label} ligado.` : `${label} desligado.`);
    } catch (error) {
      if (!(error instanceof SessionExpiredError)) message.error(`Não foi possível salvar: ${errorMessage(error)}`);
    } finally {
      setSaving(null);
    }
  }

  return (
    <Panel aria-label="Módulos">
      <Row>
        <About>
          <IconCircle $tone="blue" $size={36} aria-hidden>
            <AppstoreOutlined />
          </IconCircle>
          <div>
            <h2>Módulos</h2>
            <p>
              Escolha os módulos que aparecem no menu (a Visão Geral fica sempre ligada). Um módulo desligado sai do menu e da Visão Geral, e as telas dele ficam inacessíveis. Os dados são mantidos: ao
              ligar de novo, tudo volta como estava.
            </p>
          </div>
        </About>
        <Groups>
          {sections().map((section) => (
            <section key={section.key} aria-label={section.label ?? section.modules[0].label}>
              {section.label && <GroupTitle>{section.label}</GroupTitle>}
              <List>
                {section.modules.map((module) => {
                  const on = isEnabled(module.key);
                  const id = `module-${module.key}`;
                  return (
                    <Item key={module.key} $off={!on}>
                      <ModuleIcon $off={!on} aria-hidden>
                        {module.icon}
                      </ModuleIcon>
                      <Texts $off={!on} htmlFor={id}>
                        <strong>{module.label}</strong>
                        <small>{DESCRIPTIONS[module.key]}</small>
                      </Texts>
                      <Switch id={id} checked={on} loading={saving === module.key} disabled={saving !== null} onChange={(checked) => void toggle(module.key, module.label, checked)} />
                    </Item>
                  );
                })}
              </List>
            </section>
          ))}
        </Groups>
      </Row>
    </Panel>
  );
}
