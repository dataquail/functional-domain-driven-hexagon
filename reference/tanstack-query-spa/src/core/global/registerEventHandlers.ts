import { handleActiveTodoDelete } from '../useCases/review/eventHandlers/handleActiveTodoDelete';
import { handleActiveTodosFetched } from '../useCases/activeTodo/eventHandlers/handleActiveTodosFetched';
import { applicationEventEmitter } from './applicationEventEmitter';

const registerEventHandlers = () => {
  applicationEventEmitter.subscribe(handleActiveTodoDelete);
  applicationEventEmitter.subscribe(handleActiveTodosFetched);
};

registerEventHandlers();
