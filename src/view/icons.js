/**
 * @file Icon Asset Manager
 * @description 管理所有图标资源，并导出为 URL 映射。
 * 这使得 Vite 可以为 npm run dev 和 npm run build 提供正确的 URL。
 */

import modeEditIcon from "../icon/mode-edit.svg";
import modeSolverIcon from "../icon/mode-solver.svg";
import gridSquareIcon from "../icon/grid-square.svg";
import gridTriangleIcon from "../icon/grid-triangle.svg";
import zoomOutIcon from "../icon/zoomOut.svg";
import zoomInIcon from "../icon/zoomIn.svg";
import undoIcon from "../icon/undo.svg";
import redoIcon from "../icon/redo.svg";
import initStateIcon from "../icon/initState.svg";
import initStateInvertIcon from "../icon/initState-invert.svg";
import initStateTurnOffIcon from "../icon/initState-turnOff.svg";
import deleteIcon from "../icon/delete.svg";
import algorithmIcon from "../icon/algorithm.svg";
import restartIcon from "../icon/restart.svg";
import algorithmArbitraryIcon from "../icon/algorithm-arbitrary.svg"
import algorithmMinMoveIcon from "../icon/algorithm-minMove.svg"
import selectAllIcon from "../icon/selectAll.svg";

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
}; 