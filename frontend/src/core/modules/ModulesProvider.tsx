import { Spin } from 'antd';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';

import { modulesApi, ModulesContext } from '@/core/modules/modulesContext';

const Centered = styled.div`
  display: flex;
  min-height: 100vh;
  align-items: center;
  justify-content: center;
`;

/** Loads the turned-off modules once after login; the app waits so a turned-off module never flashes. */
export function ModulesProvider({ children }: { children: ReactNode }) {
  const [disabled, setDisabled] = useState<string[] | null>(null);

  useEffect(() => {
    modulesApi
      .get()
      .then((result) => setDisabled(result.disabled))
      // sem resposta, tudo fica ligado: o servidor continua bloqueando o que estiver desligado
      .catch(() => setDisabled([]));
  }, []);

  const save = useCallback(async (next: string[]) => {
    const result = await modulesApi.save(next);
    setDisabled(result.disabled);
  }, []);

  const value = useMemo(() => {
    const list = disabled ?? [];
    return {
      disabled: list,
      isEnabled: (key: string) => !list.includes(key),
      save,
    };
  }, [disabled, save]);

  if (disabled === null) {
    return (
      <Centered>
        <Spin size="large" />
      </Centered>
    );
  }
  return <ModulesContext.Provider value={value}>{children}</ModulesContext.Provider>;
}
