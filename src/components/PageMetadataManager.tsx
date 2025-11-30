import { useLocation } from "react-router-dom";
import { usePageMetadata } from "@/hooks/usePageMetadata";

type MetadataConfig = {
  pattern: RegExp;
  title: string;
  description: string;
};

const metadataConfig: MetadataConfig[] = [
  {
    pattern: /^\/$/,
    title: "Manifest Malawi",
    description:
      "Official Manifest Malawi platform for secure giving, testimonies, prayer requests, and community engagement.",
  },
  {
    pattern: /^\/auth/,
    title: "Unified Account Access",
    description: "Sign in or register to access Manifest Malawi giving and engagement tools.",
  },
  {
    pattern: /^\/member\/auth/,
    title: "Member Sign In",
    description: "Secure member login to track giving, testimonies, and personal engagement.",
  },
  {
    pattern: /^\/admin\/auth/,
    title: "Admin Sign In",
    description: "Administrator and finance portal access for Manifest Malawi.",
  },
  {
    pattern: /^\/dashboard$/,
    title: "Member Dashboard",
    description: "Review your giving activity, testimonies, and prayer journey.",
  },
  {
    pattern: /^\/give$/,
    title: "Give",
    description: "Record tithes, offerings, and pledges securely with Manifest Malawi.",
  },
  {
    pattern: /^\/history$/,
    title: "Giving History",
    description: "Browse and export your complete giving history and receipts.",
  },
  {
    pattern: /^\/testimony$/,
    title: "Share Testimony",
    description: "Submit testimonies securely to encourage the Manifest community.",
  },
  {
    pattern: /^\/prayer$/,
    title: "Prayer Requests",
    description: "Share prayer needs with the pastoral team and track responses.",
  },
  {
    pattern: /^\/mobilization$/,
    title: "Member Mobilization",
    description: "Invite others and track your outreach impact.",
  },
  {
    pattern: /^\/settings$/,
    title: "Account Settings",
    description: "Manage your Manifest profile, security, and preferences.",
  },
  {
    pattern: /^\/admin\/dashboard$/,
    title: "Admin Dashboard",
    description: "Monitor platform health, conversions, and engagement metrics.",
  },
  {
    pattern: /^\/admin\/events/,
    title: "Events Management",
    description: "Oversee church events, reminders, and attendance planning.",
  },
  {
    pattern: /^\/admin\/pending-services/,
    title: "Pending Services",
    description: "Review and approve pending service submissions for Manifest events.",
  },
  {
    pattern: /^\/admin\/attendance/,
    title: "Attendance",
    description: "Log and review attendance across services and visitor follow-ups.",
  },
  {
    pattern: /^\/admin\/reports\/attendance/,
    title: "Attendance Reports",
    description: "Generate attendance performance and conversion reports.",
  },
  {
    pattern: /^\/admin\/reports\/financial/,
    title: "Financial Reports",
    description: "View consolidated giving and expense performance.",
  },
  {
    pattern: /^\/admin\/givings/,
    title: "Giving Management",
    description: "Audit and verify giving submissions and receipts.",
  },
  {
    pattern: /^\/admin\/expenses/,
    title: "Expense Management",
    description: "Create, approve, and categorize church expenses.",
  },
  {
    pattern: /^\/admin\/reminders/,
    title: "Event Reminders",
    description: "Configure and audit automated reminders for services.",
  },
  {
    pattern: /^\/admin\/visitor-followup/,
    title: "Visitor Follow-up",
    description: "Track visitor follow-ups and pastoral care tasks.",
  },
  {
    pattern: /^\/admin\/users/,
    title: "User Management",
    description: "Manage Manifest user roles, invites, and security.",
  },
  {
    pattern: /^\/admin\/mobilization/,
    title: "Mobilization Reporting",
    description: "Review outreach invites, conversions, and member engagement.",
  },
  {
    pattern: /^\/admin\/conversions/,
    title: "Conversion Dashboard",
    description: "Analyze conversions across services and ministries.",
  },
  {
    pattern: /^\/admin\/audit-logs/,
    title: "Audit Logs",
    description: "Review security and activity logs across the platform.",
  },
  {
    pattern: /^\/not-found$/,
    title: "Page Not Found",
    description: "The page you are looking for does not exist on Manifest Malawi.",
  },
];

const defaultMetadata: MetadataConfig = {
  pattern: /.*/,
  title: "Manifest Malawi",
  description:
    "Secure giving, testimonies, and pastoral care tools for the Manifest Malawi community.",
};

export const PageMetadataManager = () => {
  const location = useLocation();

  const match = metadataConfig.find((entry) => entry.pattern.test(location.pathname)) || defaultMetadata;

  usePageMetadata({
    title: match.title,
    description: match.description,
    canonicalPath: location.pathname,
  });

  return null;
};
