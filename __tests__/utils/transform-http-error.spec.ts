import { transformHttpError } from '../../src/utils/transform-http-error';

describe('transformHttpError', () => {
  it('should return an HttpError object with statusText and status code if error has response', () => {
    const error = {
      response: {
        statusText: 'Not Found',
        status: 404,
      },
    };

    const expected = {
      ...error,
      message: 'Not Found',
      statusCode: 404,
    };

    expect(transformHttpError(error)).toEqual(expected);
  });

  it('should return an HttpError object with error message, undefined statusCode if error does not have response', () => {
    const error = new Error('Internal Server Error');

    const expected = {
      error: error,
      message: 'Internal Server Error',
      statusCode: undefined,
    };

    expect(transformHttpError(error)).toEqual(expected);
  });

  it('should return an HttpError object with error message as JSON string if error is an object', () => {
    const error = { message: 'Bad Request' };

    const expected = {
      error: error,
      message: '{"message":"Bad Request"}',
      statusCode: undefined,
    };

    expect(transformHttpError(error)).toEqual(expected);
  });

  it('should return an HttpError object with error message as string if error is not an object', () => {
    const error = 'Unauthorized';

    const expected = {
      error: error,
      message: 'Unauthorized',
      statusCode: undefined,
    };

    expect(transformHttpError(error)).toEqual(expected);
  });
});