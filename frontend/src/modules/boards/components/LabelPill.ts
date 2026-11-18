import styled from 'styled-components';

import type { BoardColor } from '@/modules/boards/types';
import { iconTones, radius } from '@/theme';

/** Label of the card face: a colored pill with its name (or only the color when unnamed). */
export const LabelPill = styled.span<{ $color: BoardColor }>`
  display: inline-flex;
  align-items: center;
  min-width: 36px;
  height: 18px;
  padding: 0 8px;
  border-radius: ${radius.badge}px;
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
  color: ${({ $color }) => iconTones[$color].fg};
  background: ${({ $color }) => iconTones[$color].bg};
  box-shadow: inset 3px 0 0 ${({ $color }) => iconTones[$color].fg};
`;
