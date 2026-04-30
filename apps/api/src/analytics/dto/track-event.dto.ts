import { IsObject, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class TrackEventDto {
  /// Event name in snake_case, e.g. "app_opened", "workshop_viewed".
  /// Restricted to a slug pattern so callers can't pollute the namespace
  /// with random strings, emoji, or SQL fragments.
  @IsString()
  @MaxLength(64)
  @Matches(/^[a-z][a-z0-9_]*$/, {
    message: 'name must be lowercase snake_case (e.g. workshop_viewed)',
  })
  name!: string;

  /// Free-form per-event payload (e.g. { workshopId: "...", source: "map" }).
  /// Stored as JSONB. Keep it small and flat — no PII, no secrets.
  @IsOptional()
  @IsObject()
  properties?: Record<string, unknown>;

  /// Optional — caller-supplied user UUID for cross-event linkage. Anonymous
  /// events (app_opened pre-login, signup_started) leave this null.
  @IsOptional()
  @IsUUID()
  userId?: string;
}
