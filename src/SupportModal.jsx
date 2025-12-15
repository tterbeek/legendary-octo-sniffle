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

        <h2 className="text-xl font-semibold mb-3">Enjoying GrocLi? ☺️</h2>

        <p className="text-gray-700 mb-4 text-left">
          If it’s made shopping a little easier, you can support the app by buying its maker, Thijs, a coffee ☕
          <br /><br />
          GrocLi is built and maintained by one person, and every coffee helps keep it running smoothly.
        </p>

        <a
          href="https://www.buymeacoffee.com/grocli"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          onClick={onClose}
        >
          ☕ Buy me a coffee
        </a>

        <p className="text-xs text-gray-500 mt-4 text-left">
          Totally optional — GrocLi will keep working either way.
        </p>
      </div>
    </div>
  );
}
