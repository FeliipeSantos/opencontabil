import { Button, Result } from 'antd';
import type { ReactNode } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import { MODULES_SETTINGS_PATH, moduleOfPath, useModules } from '@/core/modules/modulesContext';
import { PageContainer } from '@/core/ui';
import { MODULES } from '@/modules';

/** "/" opens the first module turned on (Ajustes > Módulos when every one is off). */
export function HomeRedirect() {
  const { isEnabled } = useModules();
  const first = MODULES.find((m) => isEnabled(m.key));
  return <Navigate to={first ? first.path : MODULES_SETTINGS_PATH} replace />;
}

/** Shows the screen only when its module is on; a turned-off module explains how to turn it back on. */
export function ModuleGate({ children }: { children: ReactNode }) {
  const { isEnabled } = useModules();
  const location = useLocation();
  const navigate = useNavigate();
  const module = moduleOfPath(MODULES, location.pathname);
  if (!module || isEnabled(module.key)) return <>{children}</>;
  return (
    <PageContainer>
      <Result
        status="info"
        title={`O módulo ${module.label} está desativado`}
        subTitle="Ele foi desligado em Ajustes > Módulos. Ligue de novo para voltar a usar."
        extra={
          <Button type="primary" onClick={() => navigate(MODULES_SETTINGS_PATH)}>
            Abrir Ajustes &gt; Módulos
          </Button>
        }
      />
    </PageContainer>
  );
}
