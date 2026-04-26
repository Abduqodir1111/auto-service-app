export enum UserRole {
  CLIENT = 'CLIENT',
  MASTER = 'MASTER',
  ADMIN = 'ADMIN',
}

export enum WorkshopStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  BLOCKED = 'BLOCKED',
}

export enum ApplicationStatus {
  NEW = 'NEW',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum ReviewStatus {
  PENDING = 'PENDING',
  PUBLISHED = 'PUBLISHED',
  REJECTED = 'REJECTED',
}

export enum PhotoStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum ReportTargetType {
  WORKSHOP = 'WORKSHOP',
  PHOTO = 'PHOTO',
  REVIEW = 'REVIEW',
}

export enum ReportStatus {
  NEW = 'NEW',
  IN_REVIEW = 'IN_REVIEW',
  RESOLVED = 'RESOLVED',
  REJECTED = 'REJECTED',
}

export enum ModerationEntityType {
  USER = 'USER',
  WORKSHOP = 'WORKSHOP',
  PHOTO = 'PHOTO',
  REVIEW = 'REVIEW',
  REPORT = 'REPORT',
}

export enum ModerationAction {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  BLOCKED = 'BLOCKED',
  UPDATED = 'UPDATED',
  VERIFIED = 'VERIFIED',
  UNVERIFIED = 'UNVERIFIED',
  RESOLVED = 'RESOLVED',
  DELETED = 'DELETED',
}

export type PaginatedResult<T> = {
  data: T[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    pageCount: number;
  };
};

export type AuthUser = {
  id: string;
  fullName: string;
  phone: string;
  email?: string | null;
  role: UserRole;
  isBlocked: boolean;
  isVerifiedMaster: boolean;
  createdAt: string;
};

export type AuthPayload = {
  accessToken: string;
  user: AuthUser;
};

export type ServiceCategory = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
};

export type WorkshopService = {
  id: string;
  name: string;
  description?: string | null;
  priceFrom?: number | null;
  priceTo?: number | null;
};

export type WorkshopPhoto = {
  id: string;
  url: string;
  key: string;
  isPrimary: boolean;
  status: PhotoStatus;
};

export type WorkshopSummary = {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  phone: string;
  telegram?: string | null;
  addressLine: string;
  city: string;
  status: WorkshopStatus;
  rejectionReason?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  averageRating: number;
  reviewsCount: number;
  favoritesCount: number;
  isFavorite?: boolean;
  isVerifiedMaster: boolean;
  createdAt: string;
  categories: ServiceCategory[];
  photos: WorkshopPhoto[];
};

export type WorkshopDetails = WorkshopSummary & {
  openingHours?: string | null;
  services: WorkshopService[];
  owner: AuthUser;
  reviews: ReviewItem[];
};

export type ReviewItem = {
  id: string;
  authorId: string;
  workshopId: string;
  rating: number;
  comment: string;
  status: ReviewStatus;
  createdAt: string;
  author: Pick<AuthUser, 'id' | 'fullName'>;
};

export type ApplicationItem = {
  id: string;
  workshopId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  carModel?: string | null;
  issueDescription: string;
  preferredDate?: string | null;
  status: ApplicationStatus;
  createdAt: string;
};

export type ReportItem = {
  id: string;
  reporterId?: string | null;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  comment?: string | null;
  status: ReportStatus;
  resolution?: string | null;
  createdAt: string;
  updatedAt: string;
};
