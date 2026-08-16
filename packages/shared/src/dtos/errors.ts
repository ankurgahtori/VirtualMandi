export type FieldError = {
  field: string;
  message: string;
  code?: string;
};

export type ErrorResponseDto = {
  error: {
    code: string;
    message: string;
    requestId?: string;
    fields?: FieldError[];
  };
};
