import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SessionIdentitySourceDto {
  @ApiProperty()
  enginePhone: boolean;

  @ApiProperty()
  persistedSession: boolean;
}

export class SessionIdentityDto {
  @ApiProperty({ example: 'openwa' })
  provider: 'openwa';

  @ApiPropertyOptional({ example: '552133946108' })
  phoneRaw: string | null;

  @ApiPropertyOptional({ example: '+552133946108' })
  phoneE164: string | null;

  @ApiPropertyOptional({ example: '552133946108@c.us' })
  providerAccountId: string | null;

  @ApiPropertyOptional({ example: '552133946108@c.us' })
  jid: string | null;

  @ApiPropertyOptional({ example: null })
  lid: string | null;

  @ApiPropertyOptional({ example: 'Auto Pecas Lips' })
  pushName: string | null;

  @ApiProperty({ example: true })
  resolved: boolean;

  @ApiProperty({ type: SessionIdentitySourceDto })
  source: SessionIdentitySourceDto;
}

export class SessionIdentityResponseDto {
  @ApiProperty({ example: true })
  ok: boolean;

  @ApiProperty({ example: 'sess_123e4567-e89b-12d3-a456-426614174000' })
  sessionId: string;

  @ApiProperty({ type: SessionIdentityDto })
  identity: SessionIdentityDto;

  @ApiPropertyOptional({ example: 'IDENTITY_PENDING' })
  reason?: string;
}
