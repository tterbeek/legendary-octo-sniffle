// src/Privacy.jsx
export default function Privacy() {
  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-3xl mx-auto bg-white shadow-md rounded-2xl p-8">
        <h1 className="text-3xl font-bold mb-4 text-center">Grocli Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-6">Last updated: 3 November 2025</p>

        <p className="mb-4">
          Grocli (“we”, “our”, “us”) is an open-source shopping list application focused on simplicity and privacy.
          We only collect the minimum amount of personal data needed to operate the service.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-2">1. Data We Collect</h2>
        <p className="mb-2">
          When you create an account, we collect your email address. No other personal details (such as your name or location) are required.
        </p>
        <p className="mb-2">
          We may also store basic technical information automatically transmitted by your browser (for example: IP address, browser type, and time of access) to keep the service secure and functional.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-2">2. Why We Collect Your Data</h2>
        <p className="mb-2">We process your email address in order to:</p>
        <ul className="list-disc list-inside mb-2 text-gray-700">
          <li>Create and manage your Grocli account</li>
          <li>Authenticate you when you sign in</li>
          <li>Communicate essential service updates (e.g., password resets)</li>
        </ul>
        <p className="mb-2">We do not use your email for marketing or share it with advertisers.</p>

        <h2 className="text-2xl font-semibold mt-6 mb-2">3. Legal Basis for Processing</h2>
        <p className="mb-2">
          We process your data under Article 6(1)(b) of the GDPR — processing necessary for the performance of a contract (providing the Grocli service). If you donate or choose optional communications, those actions may rely on your consent (Article 6(1)(a)).
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-2">4. Data Storage & Security</h2>
        <p className="mb-2">
          Your data is stored on secure servers located within the EU or with GDPR-compliant providers.
        </p>
        <ul className="list-disc list-inside mb-2 text-gray-700">
          <li>All data in transit is protected with HTTPS/TLS encryption.</li>
          <li>Passwords (if applicable) are hashed and never stored in plain text.</li>
          <li>We keep data only as long as your account remains active.</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-6 mb-2">5. Your Rights</h2>
        <p className="mb-2">Under the GDPR you have the right to:</p>
        <ul className="list-disc list-inside mb-2 text-gray-700">
          <li>Access a copy of your personal data</li>
          <li>Request correction or deletion</li>
          <li>Withdraw consent (if applicable)</li>
          <li>Object to processing in certain cases</li>
        </ul>
        <p className="mb-2">To exercise these rights, contact us at <a href="mailto:privacy@grocli.net" className="text-customGreen underline">privacy@grocli.net</a>.</p>

        <h2 className="text-2xl font-semibold mt-6 mb-2">6. Cookies & Analytics</h2>
        <p className="mb-2">
          Grocli does not use tracking or advertising cookies. We may use minimal technical cookies necessary for login sessions.
          If we add analytics in the future, we’ll update this policy and request consent where required.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-2">7. Third-Party Services</h2>
        <p className="mb-2">
          If we use third-party tools (for example, an email delivery or payment provider for donations), we ensure they are GDPR-compliant and process data only under our instructions.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-2">8. Changes to This Policy</h2>
        <p className="mb-2">
          We may update this Privacy Policy periodically. The latest version will always be available at <a href="/privacy" className="text-customGreen underline">grocli.org/privacy</a>. Material changes will be announced on our website or by email.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-2">9. Contact</h2>
        <p className="mb-2">
          Questions about privacy or data protection? <a href="mailto:privacy@grocli.net" className="text-customGreen underline">📧 privacy@grocli.net</a>
        </p>
      </div>
    </div>
  )
}
