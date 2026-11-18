import { CheckOutlined } from '@ant-design/icons';
import styled from 'styled-components';

import { BOARD_COLORS, COLOR_NAMES } from '@/modules/boards/model';
import type { BoardColor } from '@/modules/boards/types';
import { colors, iconTones } from '@/theme';

const Row = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const Swatch = styled.button<{ $color: BoardColor; $selected: boolean }>`
  width: 32px;
  height: 24px;
  display: grid;
  place-items: center;
  border-radius: 6px;
  border: 2px solid ${({ $selected }) => ($selected ? colors.textDark : 'transparent')};
  background: ${({ $color }) => iconTones[$color].fg};
  color: #fff;
  font-size: 12px;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid ${colors.blue};
    outline-offset: 2px;
  }
`;

/** The six colors of the theme, as swatches. */
export function ColorPicker({ value, onChange, label }: { value: BoardColor; onChange: (color: BoardColor) => void; label: string }) {
  return (
    <Row role="radiogroup" aria-label={label}>
      {BOARD_COLORS.map((color) => (
        <Swatch
          key={color}
          type="button"
          role="radio"
          aria-checked={value === color}
          aria-label={COLOR_NAMES[color]}
          title={COLOR_NAMES[color]}
          $color={color}
          $selected={value === color}
          onClick={() => onChange(color)}
        >
          {value === color && <CheckOutlined />}
        </Swatch>
      ))}
    </Row>
  );
}
