import { useState } from 'react';
import { activeTodoService } from 'src/core/infrastructure/services/ActiveTodoService';

export const AddNewActiveTodoForm = () => {
  const { invoke, isPending } = activeTodoService.createOne.useHook();
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.length < 1) {
      setError('Must be at least 1 character long');
      return;
    }
    setError('');
    await invoke({ title });
    setTitle('');
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-row">
        <div>
          <input
            type="text"
            className={`text-input ${error ? 'error' : ''}`}
            placeholder="Enter your todo"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (error) setError('');
            }}
          />
          {error && <div className="input-error">{error}</div>}
        </div>
        <button className="btn" type="submit" disabled={isPending}>
          {isPending ? <span className="loader loader-sm" /> : 'Add'}
        </button>
      </div>
    </form>
  );
};
