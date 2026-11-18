/**
 * Layout of the status report (screen and print). On screen it follows the platform: the
 * active theme (light or dark), the same cards, titles and table as the other modules. On
 * paper the global print style switches to the light scheme, so the PDF stays white.
 */
import styled, { css } from 'styled-components';

import { colors, fontSize, radius, shadows } from '@/theme';

/**
 * Cancelled activity or sub-activity: text struck through and darker; the actions (last
 * cell / button) keep full strength so the item can be brought back.
 */
const cancelledLook = css`
  > :not(.cancel-keep) {
    opacity: 0.45;
    text-decoration: line-through;

    /* o risco não passa sozinho para campos e seletores (modo de edição) */
    input,
    textarea,
    .ant-select-selection-item {
      text-decoration: line-through;
    }
  }
`;

/** Logical size of one printed page (landscape A4 at the base zoom). */
export const PRINT_PAGE_WIDTH = 1440;
export const PRINT_PAGE_HEIGHT = 1020;

const printExact = css`
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
`;

export const Viewport = styled.section`
  overflow-x: auto;

  @media print {
    display: block;
    overflow: visible;
  }
`;

/** The report: on screen, the page itself; on paper, one landscape sheet. */
export const Paper = styled.div`
  min-width: 960px;
  display: flex;
  flex-direction: column;
  gap: 16px;

  @media print {
    width: ${PRINT_PAGE_WIDTH}px;
    min-height: ${PRINT_PAGE_HEIGHT}px;
    margin: 0 auto;
    padding: 20px 24px;
    background-color: #fff;
    break-after: avoid;
  }
`;

const cardBase = css`
  background: ${colors.bgCard};
  border: 1px solid ${colors.border};
  border-radius: ${radius.card}px;
  box-shadow: ${shadows.sm};
`;

export const ReportHeaderBar = styled.div`
  ${cardBase}
  padding: 18px 22px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
`;

export const ProjectName = styled.h2`
  margin: 0 0 4px;
  font-size: ${fontSize.section + 2}px;
  font-weight: 600;
  color: ${colors.navy};
`;

export const StatusReportLabel = styled.span`
  font-size: ${fontSize.support}px;
  color: ${colors.textMuted};
`;

export const ReportDate = styled.span`
  font-size: ${fontSize.support}px;
  font-weight: 500;
  color: ${colors.textDark};
`;

export const DatesCard = styled.div`
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 20px;
  padding: 8px 18px;
  border: 1px solid ${colors.border};
  border-radius: ${radius.field}px;
  background: ${colors.bgSubtle};
`;

export const DatesDivider = styled.div`
  width: 1px;
  height: 32px;
  background-color: ${colors.border};
`;

export const MetricLabel = styled.span`
  display: block;
  font-size: 12px;
  color: ${colors.textMuted};
`;

export const MetricValue = styled.span`
  display: block;
  font-size: ${fontSize.body}px;
  font-weight: 600;
  color: ${colors.textDark};
`;

export const InfoRow = styled.div`
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 16px;
`;

export const InfoCard = styled.div<{ $muted?: boolean }>`
  ${cardBase}
  padding: 16px 20px;
  min-height: 90px;
  display: flex;
  flex-direction: column;
`;

/** Title of a card, the same as SectionCard's. */
export const CardLabel = styled.div`
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: ${fontSize.cardTitle}px;
  font-weight: 600;
  color: ${colors.navy};
`;

export const Dot = styled.span`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: ${colors.blue};
  display: inline-block;
`;

export const CardText = styled.div`
  font-size: ${fontSize.support}px;
  line-height: 1.55;
  color: ${colors.textDark};
  word-break: break-word;
  white-space: pre-wrap;
`;

export const MiddleRow = styled.div`
  display: grid;
  grid-template-columns: 1.5fr 1fr;
  gap: 16px;
  align-items: stretch;

  /* no PDF as subatividades ficam no detalhamento: a tabela de atividades ocupa a linha toda */
  @media print {
    grid-template-columns: minmax(0, 1fr);
  }
`;

export const MiddleCard = styled.div`
  ${cardBase}
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  min-height: 0;
`;

export const MiddleTitle = styled.div`
  margin-bottom: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  font-size: ${fontSize.cardTitle}px;
  font-weight: 600;
  color: ${colors.navy};
`;

export const Subtitle = styled.span`
  margin-left: 6px;
  font-size: 12px;
  font-weight: 400;
  color: ${colors.textMuted};
`;

/** Same look as the platform tables: plain header, thin row lines. */
export const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: ${fontSize.support}px;
  text-align: left;

  th {
    padding: 10px 12px;
    border-bottom: 1px solid ${colors.border};
    background: ${colors.bgSubtle};
    color: ${colors.textDark};
    font-weight: 500;
    font-size: ${fontSize.support}px;
  }

  td {
    padding: 9px 12px;
    border-bottom: 1px solid ${colors.border};
    color: ${colors.textDark};
    vertical-align: middle;
  }
`;

export const ActivityRow = styled.tr<{ $selected: boolean; $dragging: boolean; $dropTarget: boolean; $cancelled?: boolean }>`
  cursor: pointer;
  transition: background-color 0.15s ease;
  background-color: ${({ $selected }) => ($selected ? colors.blueSelected : 'transparent')};
  font-weight: ${({ $selected }) => ($selected ? 500 : 'inherit')};
  opacity: ${({ $dragging }) => ($dragging ? 0.4 : 1)};
  box-shadow: ${({ $dropTarget }) => ($dropTarget ? `inset 0 2px 0 ${colors.blue}` : 'none')};

  &:hover {
    background-color: ${({ $selected }) => ($selected ? colors.blueSelected : colors.bgSubtle)};
  }

  ${({ $cancelled }) => $cancelled && cancelledLook}
`;

export const SummaryRow = styled.tr`
  background-color: ${colors.bgSubtle};
  font-weight: 600;

  td {
    padding: 11px 12px;
    border-bottom: none;
    color: ${colors.navy};
  }
`;

// cancelar e excluir lado a lado
export const ActionsCell = styled.td`
  width: 72px;
  white-space: nowrap;
`;

export const IdCell = styled.td`
  width: 44px;
  text-align: center;
  color: ${colors.textMuted};
`;

export const StatusCell = styled.td`
  width: 155px;
  text-align: center;
`;

export const DragCell = styled.td`
  width: 26px;
  text-align: center;
  cursor: grab;
  color: ${colors.textMuted};
  user-select: none;

  &:active {
    cursor: grabbing;
  }
`;

/** Handle to drag a sub-activity (edit mode), like the one of the activities. */
export const DragHandle = styled.span`
  flex-shrink: 0;
  cursor: grab;
  color: ${colors.textMuted};
  user-select: none;

  &:active {
    cursor: grabbing;
  }
`;

export const StatusBadge = styled.span<{ $tone: 'done' | 'delayed' | 'ongoing' | 'todo'; $outlined?: boolean }>`
  display: inline-block;
  width: 100%;
  padding: 2px 8px;
  border-radius: ${radius.badge}px;
  font-weight: 500;
  font-size: 12px;
  text-align: center;
  white-space: nowrap;
  background-color: ${({ $tone }) => colors.status[$tone].bg};
  color: ${({ $tone }) => colors.status[$tone].text};
  border: ${({ $outlined }) => ($outlined ? `1px solid ${colors.border}` : 'none')};
  ${printExact}
`;

/** Status picker of the edit mode, filled with the color of the chosen status. */
export const StatusSelectBox = styled.div<{ $tone: 'done' | 'delayed' | 'ongoing' | 'todo' }>`
  .ant-select {
    width: 100%;
  }

  .ant-select-selector {
    background-color: ${({ $tone }) => colors.status[$tone].bg} !important;
    border-radius: ${radius.badge}px !important;
  }

  .ant-select-selection-item,
  .ant-select-arrow {
    color: ${({ $tone }) => colors.status[$tone].text};
    font-weight: 500;
    font-size: 12px;
    text-align: center;
  }
`;

export const AddRowCell = styled.td`
  border-bottom: none !important;
`;

export const AttentionRow = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
`;

const accent = { blue: colors.blue, green: colors.green, orange: colors.orange } as const;
export type Accent = keyof typeof accent;

export const AttentionCard = styled.div<{ $accent: Accent }>`
  ${cardBase}
  padding: 16px 20px;
  min-height: 90px;
  display: flex;
  flex-direction: column;
  border-top: 3px solid ${({ $accent }) => accent[$accent]};
  ${printExact}
`;

export const AttentionTitle = styled.div<{ $accent: Accent }>`
  margin-bottom: 8px;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px;
  font-size: ${fontSize.cardTitle}px;
  font-weight: 600;
  color: ${colors.navy};

  span + span {
    font-size: 12px;
    font-weight: 400;
    color: ${colors.textMuted};
  }
`;

export const BulletList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: ${fontSize.support}px;
  color: ${colors.textDark};
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
`;

export const Bullet = styled.li<{ $plain?: boolean }>`
  position: relative;
  padding-left: ${({ $plain }) => ($plain ? 0 : '14px')};
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;

  &::before {
    content: ${({ $plain }) => ($plain ? 'none' : '"•"')};
    position: absolute;
    left: 0;
    color: ${colors.textMuted};
  }
`;

export const CountBadge = styled.span<{ $color: string }>`
  min-width: 24px;
  padding: 1px 8px;
  border-radius: ${radius.pill}px;
  background-color: ${({ $color }) => $color};
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  text-align: center;
  ${printExact}
`;

export const SubActivityItem = styled.li<{ $completed: boolean; $cancelled?: boolean; $dragging?: boolean; $dropTarget?: boolean }>`
  display: flex;
  opacity: ${({ $dragging }) => ($dragging ? 0.4 : 1)};
  box-shadow: ${({ $dropTarget }) => ($dropTarget ? `inset 0 2px 0 ${colors.blue}` : 'none')};
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 9px 12px;
  margin-bottom: 6px;
  background: ${colors.bgSubtle};
  border: 1px solid ${colors.border};
  border-radius: ${radius.field}px;
  font-size: ${fontSize.support}px;
  color: ${({ $completed }) => ($completed ? colors.textMuted : colors.textDark)};

  .ant-btn {
    opacity: 0.4;
    transition: opacity 0.15s ease;
  }

  &:hover {
    background: ${colors.bgMuted};
    border-color: ${colors.borderStrong};

    .ant-btn {
      opacity: 1;
    }
  }

  ${({ $cancelled }) =>
    $cancelled &&
    css`
      background: ${colors.bgMuted};
      ${cancelledLook}
    `}
`;

export const EmptyBox = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  border: 1px dashed ${colors.borderStrong};
  border-radius: ${radius.field}px;
  color: ${colors.textMuted};
  font-size: ${fontSize.support}px;
  text-align: center;
`;

/**
 * Column of the subactivities card: takes the height of the activities table next to it
 * (the card fills it and its list scrolls inside).
 */
export const SubActivitiesColumn = styled.div`
  position: relative;
  min-height: 260px;

  @media print {
    display: none;
  }

  > * {
    position: absolute;
    inset: 0;
  }
`;

export const ScrollList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
  flex: 1;
  min-height: 0;
  overflow-y: auto;

  @media print {
    max-height: none;
    overflow: visible;
  }
`;

/** Remove button of a list item: faded until the row is hovered. */
export const RemoveItemRow = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;

  .ant-btn {
    opacity: 0.4;
    transition: opacity 0.15s ease;
  }

  &:hover .ant-btn,
  .ant-btn:focus-visible {
    opacity: 1;
  }
`;

/** Hidden on screen; only the printed report shows it. */
export const PrintOnly = styled.div`
  display: none;

  @media print {
    display: block;
  }
`;

/** Hidden on paper: edit controls (add/remove buttons, drag handles). */
export const ScreenOnly = styled.div`
  @media print {
    display: none;
  }
`;
