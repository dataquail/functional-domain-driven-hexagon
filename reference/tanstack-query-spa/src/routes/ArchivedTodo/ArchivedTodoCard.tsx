import { useState, useEffect, useRef } from 'react';
import { formatDate } from 'src/utils/formatDate';
import { IconDots, IconRestore, IconTrash } from 'src/components/icons';
import { ArchivedTodo } from 'src/core/domain/archivedTodo/entities/ArchivedTodo';
import { archivedTodoService } from 'src/core/infrastructure/services/ArchivedTodoService';

type Props = {
  archivedTodo: ArchivedTodo;
};

export const ArchivedTodoCard = ({ archivedTodo }: Props) => {
  const unarchiveOne = archivedTodoService.unarchiveOne.useHook();
  const deleteOne = archivedTodoService.deleteOne.useHook();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  return (
    <div className="archived-card">
      <div className="archived-card-info">
        {(deleteOne.isPending || unarchiveOne.isPending) && (
          <div className="loader loader-sm" />
        )}
        <h4>{archivedTodo.title}</h4>
        <span className="text-sm">{`Completed At: ${formatDate(archivedTodo.completedAt)}`}</span>
        <span className="text-sm">{`Archived At: ${formatDate(archivedTodo.archivedAt)}`}</span>
      </div>
      <div className="menu-wrapper" ref={menuRef}>
        <button
          type="button"
          className="menu-trigger"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <IconDots />
        </button>
        {menuOpen && (
          <div className="menu-dropdown">
            <div className="menu-label">Archived Todo Options</div>
            <button
              type="button"
              className="menu-item"
              onClick={() => {
                unarchiveOne.invoke({ id: archivedTodo.id });
                setMenuOpen(false);
              }}
            >
              <IconRestore /> Unarchive
            </button>
            <button
              type="button"
              className="menu-item danger"
              onClick={() => {
                deleteOne.invoke({ id: archivedTodo.id });
                setMenuOpen(false);
              }}
            >
              <IconTrash size="0.875rem" /> Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
