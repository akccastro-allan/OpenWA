import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SessionRuntimeResponseDto {
  @ApiProperty({ example: true })
  ok: boolean;

  @ApiProperty()
  sessionId: string;

  @ApiPropertyOptional()
  sessionAlias?: string | null;

  @ApiPropertyOptional()
  declaredStatus?: string | null;

  @ApiPropertyOptional()
  providerState?: string | null;

  @ApiPropertyOptional()
  whatsappWebVersion?: string | null;

  @ApiPropertyOptional()
  wwjsVersion?: string | null;

  @ApiProperty()
  clientExists: boolean;

  @ApiProperty()
  pageExists: boolean;

  @ApiPropertyOptional()
  pageClosed?: boolean | null;

  @ApiProperty()
  identityResolved: boolean;

  @ApiProperty()
  phoneResolved: boolean;

  @ApiPropertyOptional()
  readyEventAt?: string | null;

  @ApiPropertyOptional()
  lastMessageAt?: string | null;

  @ApiPropertyOptional()
  lastMessageCreateAt?: string | null;

  @ApiPropertyOptional()
  lastAckAt?: string | null;

  @ApiPropertyOptional()
  lastStateChangeAt?: string | null;

  @ApiPropertyOptional()
  lastDisconnectedAt?: string | null;

  @ApiProperty()
  runtimeGeneration: number;

  @ApiProperty()
  selfHealScheduled: boolean;

  @ApiPropertyOptional()
  phoneE164?: string | null;
}
