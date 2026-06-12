import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type CloudNotificationType = "success" | "warning" | "info" | "pending";

export type CloudNotification = {
  id: string;
  type: CloudNotificationType;
  title: string;
  message: string;
  detail?: string;
  author?: string;
  createdAt: number;
  read: boolean;
};

type AddNotificationInput = Omit<
  CloudNotification,
  "id" | "createdAt" | "read"
>;

type PendingCloudReview = {
  id: string;
  songId: string;
  artist: string;
  title: string;
  duration?: number;
  createdAt: number;
};

type TrackReviewInput = Omit<PendingCloudReview, "createdAt">;

type ReviewResponse = {
  id: string;
  status: "pending" | "approved" | "rejected";
  title?: string;
  message?: string;
  detail?: string;
  author?: string;
};

type CloudNotificationsState = {
  notifications: CloudNotification[];
  unreadCount: number;
  addNotification: (notification: AddNotificationInput) => void;
  trackReview: (review: TrackReviewInput) => void;
  markAllRead: () => void;
  clearNotifications: () => void;
};

const NOTIFICATIONS_STORAGE_KEY = "cloud-notifications-v1";
const PENDING_REVIEWS_STORAGE_KEY = "cloud-pending-ttml-reviews-v1";
const DEFAULT_REVIEW_ENDPOINT =
  "https://cloud-production-4b12.up.railway.app/api/ttml/review";

const CloudNotificationsContext = createContext<
  CloudNotificationsState | undefined
>(undefined);

const fallbackNotificationsState: CloudNotificationsState = {
  notifications: [],
  unreadCount: 0,
  addNotification: () => {},
  trackReview: () => {},
  markAllRead: () => {},
  clearNotifications: () => {},
};

function readStoredValue<T>(key: string, fallback: T): T {
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function createNotificationId() {
  return `cloud-notification-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

function getReviewStatusUrl(reviewId: string) {
  const endpoint =
    import.meta.env.VITE_TTML_REVIEW_ENDPOINT?.trim() ||
    DEFAULT_REVIEW_ENDPOINT;
  return `${endpoint.replace(/\/+$/, "")}/${reviewId}`;
}

export function CloudNotificationsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [notifications, setNotifications] = useState<CloudNotification[]>(() =>
    readStoredValue(NOTIFICATIONS_STORAGE_KEY, []),
  );
  const [pendingReviews, setPendingReviews] = useState<PendingCloudReview[]>(
    () => readStoredValue(PENDING_REVIEWS_STORAGE_KEY, []),
  );

  const addNotification = useCallback((notification: AddNotificationInput) => {
    setNotifications((current) => [
      {
        ...notification,
        id: createNotificationId(),
        createdAt: Date.now(),
        read: false,
      },
      ...current,
    ]);
  }, []);

  const trackReview = useCallback((review: TrackReviewInput) => {
    setPendingReviews((current) => {
      if (current.some((pending) => pending.id === review.id)) return current;
      return [...current, { ...review, createdAt: Date.now() }];
    });
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((current) =>
      current.map((notification) => ({ ...notification, read: true })),
    );
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      NOTIFICATIONS_STORAGE_KEY,
      JSON.stringify(notifications.slice(0, 100)),
    );
  }, [notifications]);

  useEffect(() => {
    window.localStorage.setItem(
      PENDING_REVIEWS_STORAGE_KEY,
      JSON.stringify(pendingReviews),
    );
  }, [pendingReviews]);

  useEffect(() => {
    if (pendingReviews.length === 0) return;

    let cancelled = false;

    const pollReviews = async () => {
      await Promise.all(
        pendingReviews.map(async (pending) => {
          try {
            const response = await fetch(getReviewStatusUrl(pending.id));
            if (!response.ok) return;

            const review = (await response.json()) as ReviewResponse;
            if (review.status === "pending" || cancelled) return;

            addNotification({
              type: review.status === "approved" ? "success" : "warning",
              title:
                review.title ??
                (review.status === "approved"
                  ? "TTML aprobado"
                  : "TTML necesita ajustes"),
              message:
                review.message ??
                `${pending.artist} - ${pending.title} ya fue revisado por el equipo.`,
              detail: review.detail,
              author: review.author ?? "Cloud",
            });

            setPendingReviews((current) =>
              current.filter((item) => item.id !== pending.id),
            );

            if (review.status === "approved") {
              window.dispatchEvent(
                new CustomEvent("cloud:ttml-approved", {
                  detail: {
                    songId: pending.songId,
                    artist: pending.artist,
                    title: pending.title,
                    duration: pending.duration,
                  },
                }),
              );
            }
          } catch {
            // A temporary network failure is retried on the next poll.
          }
        }),
      );
    };

    void pollReviews();
    const interval = window.setInterval(pollReviews, 12_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [pendingReviews, addNotification]);

  const unreadCount = notifications.filter(
    (notification) => !notification.read,
  ).length;

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      addNotification,
      trackReview,
      markAllRead,
      clearNotifications,
    }),
    [
      notifications,
      unreadCount,
      addNotification,
      trackReview,
      markAllRead,
      clearNotifications,
    ],
  );

  return (
    <CloudNotificationsContext.Provider value={value}>
      {children}
    </CloudNotificationsContext.Provider>
  );
}

export function useCloudNotifications() {
  const context = useContext(CloudNotificationsContext);
  return context ?? fallbackNotificationsState;
}
