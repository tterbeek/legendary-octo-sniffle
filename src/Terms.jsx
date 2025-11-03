// src/Terms.jsx
export default function Terms() {
  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-3xl mx-auto bg-white shadow-md rounded-2xl p-8">
        <h1 className="text-3xl font-bold mb-4 text-center">Grocli Terms of Service</h1>
        <p className="text-sm text-gray-500 mb-6">Last updated: 3 November 2025</p>

        <p className="mb-4">
          Welcome to Grocli (“we”, “our”, “us”), an open-source shopping list application. By accessing or using our service, you agree to be bound by these Terms of Service.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-2">1. Using Grocli</h2>
        <p className="mb-2">
          You may use Grocli to create and manage shopping lists. You are responsible for maintaining the confidentiality of your account and for all activities under your account.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-2">2. Account Registration</h2>
        <p className="mb-2">
          You must provide a valid email address to create an account. The email address may be used for authentication and essential communications only.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-2">3. User Conduct</h2>
        <p className="mb-2">
          You agree not to use Grocli to engage in any illegal or harmful activities, including but not limited to:
        </p>
        <ul className="list-disc list-inside mb-2 text-gray-700">
          <li>Uploading malicious content or malware</li>
          <li>Attempting to access other users’ accounts without permission</li>
          <li>Violating applicable laws or regulations</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-6 mb-2">4. Data and Privacy</h2>
        <p className="mb-2">
          Our Privacy Policy explains how we collect, store, and process your data. By using Grocli, you agree to the collection and use of information in accordance with the Privacy Policy.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-2">5. Intellectual Property</h2>
        <p className="mb-2">
          Grocli is open-source software. All content, code, and branding are protected by applicable copyright and intellectual property laws. You may use, modify, and distribute the software under the terms of its open-source license.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-2">6. Disclaimer of Warranties</h2>
        <p className="mb-2">
          Grocli is provided “as is” without warranties of any kind. We do not guarantee that the service will be uninterrupted, secure, or error-free. Use at your own risk.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-2">7. Limitation of Liability</h2>
        <p className="mb-2">
          To the maximum extent permitted by law, we are not liable for any direct, indirect, incidental, or consequential damages arising from your use of Grocli.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-2">8. Changes to Terms</h2>
        <p className="mb-2">
          We may update these Terms of Service from time to time. The latest version will always be available at <a href="/terms" className="text-customGreen underline">grocli.org/terms</a>. Material changes will be communicated on our website or via email.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-2">9. Contact</h2>
        <p className="mb-2">
          If you have any questions about these Terms of Service, please contact us at <a href="mailto:info@grocli.net" className="text-customGreen underline">📧 info@grocli.net</a>.
        </p>
      </div>
    </div>
  )
}
