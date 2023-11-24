import { HttpError } from '@refinedev/core';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const transformHttpError = (error: any): HttpError => {
  if (error?.response) {
    return {
      ...error,
      message: error.response?.statusText,
      statusCode: error.response?.status,
    };
  }
  return {
    error: error,
    message:
      typeof error === 'object'
        ? error instanceof Error
          ? error.message
          : JSON.stringify(error)
        : String(error),
    statusCode: undefined as unknown as number,
  };
};
