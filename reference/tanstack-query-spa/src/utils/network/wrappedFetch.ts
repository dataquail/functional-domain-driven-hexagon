/**
 * wrappedFetch is a wrapper around fetch that streamlines the declaration of fetches,
 * specifying authentication headers, and error handling.
 *
 * @param endpoint - fetch endpoint
 * @param fetchOptionsOverride - fetch options, such as method, headers, body, etc. Defaults to a get request with no caching.
 * @param configOverride - configuration options for wrappedFetch. Defaults to isAuthenticatedFetch being true.
 *
 * @returns - the JSON response from the fetch. All responses are expected to be JSON.
 *
 * @throws JsonParseError - if the fetch response JSON parsing fails
 * @throws RequestFailedError - if the fetch response status code is not ok
 * @throws UnknownFetchError - if the fetch fails for an unknown reason
 *
 * @example
 *
 * const response = await wrappedFetch<TodoDto>(`${getConfig().API_URL}/todo`, {
 *   method: 'post',
 *   headers: {
 *     Accept: 'application/json',
 *     'Content-Type': 'application/json',
 *   },
 *   body: JSON.stringify(createTodoBody),
 * })
 * .catch((error: unknown) => {
 *   // do custom error handling depending on the needs of the endpoint
 *   if (isJsonParseError(error)) {
 *     throw new Error('JSON Parse Error');
 *   } else if (isRequestFailedError(error)) {
 *     throw new Error('Request Failed');
 *   } else if (isUnknownFetchError(error)) {
 *     throw new Error('Unknown Fetch Error');
 *   } else {
 *     throw new Error('Unknown Error');
 *   }
 * });
 */

export const wrappedFetch = async <T, E = void>(
  endpoint: string,
  fetchOptionsOverride: Parameters<typeof fetch>[1] = {},
) => {
  const fetchOptions = {
    cache: 'no-store' as const,
    method: 'get',
    ...fetchOptionsOverride,
  };

  try {
    const response = await fetch(endpoint, fetchOptions);

    if (response.ok) {
      try {
        const json: T = await response.json();
        return json;
      } catch (error: unknown) {
        if (isError(error)) {
          throw new JsonParseError(
            error.message,
            fetchOptions.method,
            endpoint,
            'response ok',
          );
        } else {
          throw new UnknownFetchError(
            fetchOptions.method,
            endpoint,
            'response ok, json parse',
          );
        }
      }
    } else {
      try {
        const errorJson: E = await response.json();
        throw new RequestFailedError<E>(
          fetchOptions.method,
          endpoint,
          response.status,
          errorJson,
        );
      } catch (error: unknown) {
        if (isError(error)) {
          if (isRequestFailedError<E>(error)) {
            throw error;
          } else {
            throw new JsonParseError(
              error.message,
              fetchOptions.method,
              endpoint,
              'response not ok',
            );
          }
        } else {
          throw new UnknownFetchError(
            fetchOptions.method,
            endpoint,
            'response not ok, json parse',
          );
        }
      }
    }
  } catch (error: unknown) {
    if (isJsonParseError(error)) {
      throw error;
    } else if (isUnknownFetchError(error)) {
      throw error;
    } else if (isRequestFailedError<E>(error)) {
      throw error;
    } else if (isError(error)) {
      throw new UnknownFetchError(
        fetchOptions.method,
        endpoint,
        'unknown context, thrown as Error type',
      );
    } else {
      throw new UnknownFetchError(
        fetchOptions.method,
        endpoint,
        'unknown context, unknown type',
      );
    }
  }
};

export const isError = (error: unknown): error is Error => {
  return error instanceof Error;
};

export class JsonParseError extends Error {
  constructor(
    override readonly message: string,
    readonly method: string,
    readonly endpoint: string,
    readonly context: string,
  ) {
    super();
    this.name =
      `JsonParseError ${method} ${endpoint} during ${context}` as const;
    this.message = message;
  }
}

export const isJsonParseError = (error: unknown): error is JsonParseError => {
  return isError(error) && error instanceof JsonParseError;
};

export class RequestFailedError<E> extends Error {
  constructor(
    readonly method: string,
    readonly endpoint: string,
    readonly statusCode: number,
    readonly context?: E,
  ) {
    super();
    this.name = 'RequestFailedError';
    this.message =
      `${method} ${endpoint} with status code ${statusCode} and context ${context}.` as const;
    this.context = context;
  }
}

export const isRequestFailedError = <E>(
  error: unknown,
): error is RequestFailedError<E> => {
  return isError(error) && error instanceof RequestFailedError;
};

export class UnknownFetchError extends Error {
  constructor(
    readonly method: string,
    readonly endpoint: string,
    readonly context: string,
  ) {
    super();
    this.name = 'UnknownFetchError';
    this.message = `${method} ${endpoint} error during ${context}` as const;
  }
}

export const isUnknownFetchError = (
  error: unknown,
): error is UnknownFetchError => {
  return isError(error) && error instanceof UnknownFetchError;
};
