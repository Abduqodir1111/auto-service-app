import { ApplicationStatus, PhotoStatus, ReviewStatus, ServiceCategory, UserRole, WorkshopStatus } from '@stomvp/shared';

export type AdminUser = {
  id: string;
  fullName: string;
  phone: string;
  email?: string | null;
  role: UserRole;
  isBlocked: boolean;
  createdAt: string;
};

export type AdminAnalytics = {
  totalUsers: number;
  totalMasters: number;
  totalWorkshops: number;
  pendingWorkshops: number;
  pendingReviews: number;
  pendingPhotos: number;
  totalApplications: number;
};

export type AdminWorkshop = {
  id: string;
  title: string;
  city: string;
  phone: string;
  addressLine: string;
  status: WorkshopStatus;
  rejectionReason?: string | null;
  owner: {
    id: string;
    fullName: string;
    phone: string;
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
