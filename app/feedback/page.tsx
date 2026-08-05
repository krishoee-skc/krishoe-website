import FeedbackForm from "@/components/FeedbackForm";

export const metadata = {
  title: "Share Your Feedback | KRISHOE",
  description: "Help us improve by sharing your feedback, bug reports, and feature requests",
};

export default function FeedbackPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-12 px-4">
      <FeedbackForm />
    </div>
  );
}
