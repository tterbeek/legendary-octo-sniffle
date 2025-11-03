import React from 'react';

export default function SupportModal({ onClose }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-lg w-80 p-6 relative text-center">
        <button
          className="absolute top-2 right-3 text-gray-500 hover:text-gray-700 text-lg"
          onClick={onClose}
        >
          ✕
        </button>

        <h2 className="text-xl font-semibold mb-3">Support the Developer</h2>

        <p className="text-gray-700 mb-4">
          GrocLi is built and maintained by one person — Thijs 💚
          <br />
          If you enjoy using GrocLi and want to help keep it running,
          you can buy Thijs a coffee ☕
        </p>

        <a
          href="https://www.buymeacoffee.com/grocli"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          onClick={onClose}
        >
          ☕ Buy Me a Coffee
        </a>

        <p className="text-xs text-gray-500 mt-4">
          Donations are voluntary and go directly to Thijs to support GrocLi’s hosting and development.
        </p>
      </div>
    </div>
  );
}
