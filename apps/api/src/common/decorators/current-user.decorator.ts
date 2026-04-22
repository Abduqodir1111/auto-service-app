import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserRole } from '@stomvp/shared';

export type JwtUser = {
  sub: string;
  role: UserRole;
  phone: string;
  fullName?: string;
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as JwtUser;
  },
);
