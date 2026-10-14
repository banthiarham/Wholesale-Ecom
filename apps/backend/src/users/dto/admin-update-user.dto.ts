import { UpdateUserDto } from './update-user.dto';

/** Everything an admin can edit on a customer's profile (same fields as creating a user, all optional). */
export class AdminUpdateUserDto extends UpdateUserDto {}
