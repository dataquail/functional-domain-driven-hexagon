import 'src/core/global/registerEventHandlers';
import './styles.css';
import { StrictMode } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import * as ReactDOM from 'react-dom/client';
import { ErrorPage } from './components/ErrorPage';
import { Providers } from './providers';
import { ActiveTodo } from './routes/ActiveTodo';
import { ArchivedTodo } from './routes/ArchivedTodo';
import { Review } from './routes/Review';

const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <ActiveTodo />,
      errorElement: <ErrorPage />,
    },
    {
      path: '/archived',
      element: <ArchivedTodo />,
      errorElement: <ErrorPage />,
    },
    {
      path: '/review',
      element: <Review />,
      errorElement: <ErrorPage />,
    },
  ],
  { basename: import.meta.env.BASE_URL },
);

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <StrictMode>
      <Providers>
        <RouterProvider router={router} />
      </Providers>
    </StrictMode>,
  );
}
