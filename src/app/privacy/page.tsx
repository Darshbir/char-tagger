"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Layout } from "@/components/Layout";

export default function PrivacyPage() {
  const router = useRouter();
  return (
    <Layout onLogoClick={() => router.push("/")}>
      <main className="tt-privacy">
        <div className="tt-privacy-inner">
          <h1 className="tt-privacy-title">Privacy Policy</h1>
          <p className="tt-privacy-updated">Last updated: March 2025</p>

          <section className="tt-privacy-section">
            <h2>1. Introduction</h2>
            <p>
              TripTag (&quot;we&quot;, &quot;our&quot;, or &quot;the app&quot;) is a privacy-first web application that helps you sort trip photos by person. This policy explains what data we collect, how we use it, and what never leaves your device.
            </p>
          </section>

          <section className="tt-privacy-section">
            <h2>2. Data that never leaves your device</h2>
            <p>
              <strong>Photos and face data.</strong> All photo processing (face detection, embeddings, clustering) runs entirely in your browser. Your images and any derived face data are never uploaded to our servers. We have no access to your photos.
            </p>
            <p>
              <strong>Local storage.</strong> The app may store preferences in your browser&apos;s localStorage (for example, clustering settings and detector options) under keys prefixed with <code>char-tagger-</code>. This data stays on your device and is not sent to us.
            </p>
          </section>

          <section className="tt-privacy-section">
            <h2>3. Optional Google sign-in (Drive export)</h2>
            <p>
              If you choose to sign in with Google to export results to Google Drive, we use OAuth to obtain limited access to your Drive. Our server stores an encrypted refresh token in an httpOnly, secure cookie so we can perform export requests on your behalf. We do not receive, store, or process your photos; only metadata and file operations for the export flow pass through our infrastructure.
            </p>
            <p>
              You can revoke access at any time via your Google account settings or by signing out of TripTag. Google&apos;s use of your data is governed by Google&apos;s Privacy Policy.
            </p>
          </section>

          <section className="tt-privacy-section">
            <h2>4. Analytics (if enabled)</h2>
            <p>
              We may use privacy-preserving analytics (e.g. cookie-free, no personal data) to understand usage (e.g. page views). Such tools are configured to avoid collecting personally identifiable information or any content from your photos or Drive. If we enable analytics, we will choose providers that align with our privacy commitments.
            </p>
          </section>

          <section className="tt-privacy-section">
            <h2>5. What we do not do</h2>
            <p>
              We do not sell your data. We do not use your photos or face data for advertising or profiling. We do not require an account to use the core tagging features; sign-in is only for optional Google Drive export.
            </p>
          </section>

          <section className="tt-privacy-section">
            <h2>6. Changes</h2>
            <p>
              We may update this policy from time to time. The &quot;Last updated&quot; date at the top will be revised when we do. Continued use of the app after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section className="tt-privacy-section">
            <h2>7. Contact</h2>
            <p>
              If you have questions about this privacy policy or our practices, you can reach us via the contact method provided on the main TripTag site (e.g. support or feedback link).
            </p>
          </section>

          <p className="tt-privacy-back">
            <Link href="/" className="tt-privacy-link">
              ← Back to TripTag
            </Link>
          </p>
        </div>
      </main>
    </Layout>
  );
}
