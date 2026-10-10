import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { MessageSquare } from "lucide-react";
import ScrollRotatingLogo from "@/components/ScrollRotatingLogo";

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-[#aee4ff] flex items-center justify-center px-4 py-16">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(0,151,178,0.18),_transparent_55%)]" />
      <div className="relative w-full max-w-4xl grid md:grid-cols-[1.1fr_0.9fr] gap-10 items-center">
        <div className="space-y-6 text-[#004d6d]/90">
          <Link href="/" className="text-sm text-[#0097b2] hover:underline">
            ← Back to home
          </Link>
          <div className="mb-2">
            <ScrollRotatingLogo size="lg" className="rounded-xl shadow-lg" />
          </div>
          <h1 className="text-3xl md:text-4xl font-semibold text-[#004d6d]">
            Start your CarePilot trial in minutes.
          </h1>
          <p className="text-base leading-relaxed">
            Create your account to organize care and verify your identity before continuing with Reap.
          </p>
          <div className="flex items-center gap-3 text-sm">
            <MessageSquare className="h-4 w-4 text-[#0097b2]" />
            Organize, quote and authorize from your family hub
          </div>
        </div>
        <AuthForm mode="signup" />
      </div>
    </div>
  );
}
