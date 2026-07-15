import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApprovalAction } from '../entities/post-approval.entity';

export class SubmitApprovalDto {
  @IsEnum(ApprovalAction)
  action: ApprovalAction;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;

  @IsString()
  @MaxLength(255)
  clientIdentifier: string;
}
