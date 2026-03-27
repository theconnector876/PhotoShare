export default function Privacy() {
  return (
    <div className="pt-16 pb-20 bg-background relative z-10">
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-8 text-sm text-muted-foreground leading-relaxed">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-1">Privacy Policy</h1>
          <p className="text-xs">Last updated: March 2026</p>
        </div>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">1. Who We Are</h2>
          <p>
            ConnectAGrapher ("we", "us", "our") is a photography booking platform that connects
            clients with professional photographers. Our app is available at connectagrapher.com.
            For questions about this policy, contact us at support@connectagrapher.com.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">2. Information We Collect</h2>
          <ul className="list-disc list-inside space-y-1">
            <li><strong className="text-foreground">Account information:</strong> Name, email address, phone number, and profile photo.</li>
            <li><strong className="text-foreground">Booking information:</strong> Service type, date, location, and payment records.</li>
            <li><strong className="text-foreground">Photos & galleries:</strong> Images you upload or that are uploaded on your behalf.</li>
            <li><strong className="text-foreground">Messages:</strong> Chat messages sent through the platform between clients, photographers, and support.</li>
            <li><strong className="text-foreground">Payment information:</strong> Transactions are processed by WiPay Caribbean. We do not store your card details.</li>
            <li><strong className="text-foreground">Usage data:</strong> Pages visited, features used, and device/browser information for analytics.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">3. How We Use Your Information</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>To process and manage photography bookings.</li>
            <li>To communicate booking confirmations, updates, and receipts via email.</li>
            <li>To enable chat between clients, photographers, and support.</li>
            <li>To display your portfolio and profile to prospective clients (photographers only).</li>
            <li>To process payments through WiPay Caribbean.</li>
            <li>To improve the platform through analytics.</li>
            <li>To comply with legal obligations.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">4. Sharing of Information</h2>
          <p>We do not sell your personal information. We share data only with:</p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong className="text-foreground">WiPay Caribbean</strong> — payment processing.</li>
            <li><strong className="text-foreground">Cloudinary</strong> — secure image storage and delivery.</li>
            <li><strong className="text-foreground">Resend</strong> — transactional email delivery.</li>
            <li><strong className="text-foreground">Neon / PostgreSQL</strong> — encrypted database hosting.</li>
            <li><strong className="text-foreground">Vercel</strong> — application hosting.</li>
            <li>Law enforcement or regulators when required by law.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">5. Photos & Galleries</h2>
          <p>
            Photos uploaded to your gallery are stored securely on Cloudinary and are only accessible
            via your unique gallery link and access code. Photographers and admins may view galleries
            related to bookings they are assigned to. Published portfolio images are visible to the public.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">6. Data Retention</h2>
          <p>
            We retain your account data for as long as your account is active. Booking records are
            retained for up to 7 years for legal and financial compliance. You may request deletion
            of your account at any time (see Section 8).
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">7. Your Rights</h2>
          <p>You have the right to:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Access the personal data we hold about you.</li>
            <li>Correct inaccurate information.</li>
            <li>Request deletion of your account and associated data.</li>
            <li>Withdraw consent for marketing communications at any time.</li>
          </ul>
          <p>To exercise these rights, contact us at support@connectagrapher.com.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">8. Account Deletion</h2>
          <p>
            You can delete your account at any time from the Profile tab in your dashboard. Once
            deleted, your account and personal data will be permanently removed within 30 days.
            Booking records may be retained in anonymised form for legal compliance. Gallery images
            associated with your account will also be removed.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">9. Cookies</h2>
          <p>
            We use session cookies to keep you logged in. We do not use third-party advertising
            cookies. Analytics are collected in aggregate and do not identify individual users.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">10. Children's Privacy</h2>
          <p>
            ConnectAGrapher is not directed at children under 13. We do not knowingly collect
            personal information from children. If you believe a child has provided us with
            their data, contact us at support@connectagrapher.com and we will delete it promptly.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">11. Changes to This Policy</h2>
          <p>
            We may update this policy from time to time. Changes will be posted on this page with
            an updated date. Continued use of the platform after changes constitutes acceptance.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">12. Contact</h2>
          <p>
            ConnectAGrapher<br />
            Email: support@connectagrapher.com<br />
            Website: connectagrapher.com
          </p>
        </section>
      </div>
    </div>
  );
}
