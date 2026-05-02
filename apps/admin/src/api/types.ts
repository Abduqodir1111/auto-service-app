import {
  ApplicationStatus,
  ModerationAction,
  ModerationEntityType,
  PhotoStatus,
  ReportStatus,
  ReportTargetType,
  ReviewStatus,
  ServiceCategory,
  UserRole,
  WorkshopStatus,
} from '@stomvp/shared';

export type AdminUser = {
  id: string;
  fullName: string;
  phone: string;
  email?: string | null;
  role: UserRole;
  isBlocked: boolean;
  isVerifiedMaster: boolean;
  createdAt: string;
};

export type AdminAnalytics = {
  totalUsers: number;
  totalMasters: number;
  totalWorkshops: number;
  pendingWorkshops: number;
  pendingReviews: number;
  pendingPhotos: number;
  pendingReports: number;
  totalApplications: number;
};

export type AdminEventName =
  | 'app_opened'
  | 'signup_started'
  | 'signup_completed'
  | 'workshop_viewed'
  | 'application_created'
  | string;

export type AdminEventsAnalytics = {
  totals: {
    totalUsers: number;
    active24h: number;
    active7d: number;
    totalApplications: number;
    totalEvents: number;
  };
  funnel: Array<{ event: AdminEventName; count: number }>;
  activityByDay: Array<{ day: string; count: number }>;
  topWorkshops: Array<{ workshopId: string; title: string; views: number }>;
  recentEvents: Array<{
    id: string;
    name: AdminEventName;
    properties: Record<string, unknown> | null;
    userId: string | null;
    userName: string | null;
    userPhone: string | null;
    ip: string | null;
    userAgent: string | null;
    createdAt: string;
  }>;
};

export type AdminWorkshop = {
  id: string;
  title: string;
  city: string;
  phone: string;
  addressLine: string;
  status: WorkshopStatus;
  rejectionReason?: string | null;
  isVerifiedMaster: boolean;
  owner: {
    id: string;
    fullName: string;
    phone: string;
    isVerifiedMaster?: boolean;
  };
  categories: ServiceCategory[];
  services: Array<{
    id: string;
    name: string;
    priceFrom?: number | null;
    priceTo?: number | null;
  }>;
  photos: Array<{
    id: string;
    url: string;
    status: PhotoStatus;
    isPrimary: boolean;
  }>;
};

export type AdminReview = {
  id: string;
  rating: number;
  comment: string;
  status: ReviewStatus;
  createdAt: string;
  author: {
    id: string;
    fullName: string;
  };
  workshop: {
    id: string;
    title: string;
  };
};

export type AdminPhoto = {
  id: string;
  url: string;
  status: PhotoStatus;
  isPrimary: boolean;
  createdAt: string;
  workshop: {
    id: string;
    title: string;
  };
  uploader: {
    id: string;
    fullName: string;
  };
};

export type AdminApplication = {
  id: string;
  customerName: string;
  customerPhone: string;
  carModel?: string | null;
  issueDescription: string;
  preferredDate?: string | null;
  status: ApplicationStatus;
  createdAt: string;
  workshop?: {
    id: string;
    title: string;
    phone: string;
  } | null;
};

export type AdminReport = {
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
  reporter?: {
    id: string;
    fullName: string;
    phone: string;
  } | null;
  target?: {
    id: string;
    title: string;
    type: ReportTargetType;
    status?: string;
    comment?: string;
    owner?: {
      id: string;
      fullName: string;
      phone: string;
    };
    workshop?: {
      id: string;
      title: string;
    };
    author?: {
      id: string;
      fullName: string;
    };
  } | null;
};

export type AdminModerationLog = {
  id: string;
  actorId?: string | null;
  entityType: ModerationEntityType;
  entityId: string;
  action: ModerationAction;
  fromStatus?: string | null;
  toStatus?: string | null;
  note?: string | null;
  metadata?: unknown;
  createdAt: string;
  actor?: {
    id: string;
    fullName: string;
    phone: string;
  } | null;
};
