/**
 * @file Icon Asset Manager
 * @description 管理所有图标资源，并导出为 URL 映射。
 * 这使得 Vite 可以为 npm run dev 和 npm run build 提供正确的 URL。
 */

import modeEditIcon from "./icons/mode-edit.svg";
import modeSolverIcon from "./icons/mode-solver.svg";
import gridSquareIcon from "./icons/grid-square.svg";
import gridTriangleIcon from "./icons/grid-triangle.svg";
import zoomOutIcon from "./icons/zoomOut.svg";
import zoomInIcon from "./icons/zoomIn.svg";
import undoIcon from "./icons/undo.svg";
import redoIcon from "./icons/redo.svg";
import initStateIcon from "./icons/initState.svg";
import initStateInvertIcon from "./icons/initState-invert.svg";
import initStateTurnOffIcon from "./icons/initState-turnOff.svg";
import deleteIcon from "./icons/delete.svg";
import algorithmIcon from "./icons/algorithm.svg";
import restartIcon from "./icons/restart.svg";
import algorithmArbitraryIcon from "./icons/algorithm-arbitrary.svg";
import algorithmMinMoveIcon from "./icons/algorithm-minMove.svg";
import selectAllIcon from "./icons/selectAll.svg";

/**
 * 所有图标的 URL 映射。
 */
export const ICONS = {
  MODE_EDIT: modeEditIcon,
  MODE_SOLVER: modeSolverIcon,
  GRID_SQUARE: gridSquareIcon,
  GRID_TRIANGLE: gridTriangleIcon,
  ZOOM_OUT: zoomOutIcon,
  ZOOM_IN: zoomInIcon,
  UNDO: undoIcon,
  REDO: redoIcon,
  INIT_STATE: initStateIcon,
  INIT_STATE_INVERT: initStateInvertIcon,
  INIT_STATE_TURN_OFF: initStateTurnOffIcon,
  DELETE: deleteIcon,
  ALGORITHM: algorithmIcon,
  RESTART: restartIcon,
  ALGORITHM_ARBITRARY: algorithmArbitraryIcon,
  ALGORITHM_MIN_MOVE: algorithmMinMoveIcon,
  SELECT_ALL: selectAllIcon,
} as const;
