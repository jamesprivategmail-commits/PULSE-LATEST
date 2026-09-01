import React, { useState } from 'react';
import { Search, Filter } from 'lucide-react';

const SearchPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([
    { id: 1, title: 'Result 1', description: 'Description for result 1' },
    { id: 2, title: 'Result 2', description: 'Description for result 2' },
  ]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="relative">
          <Search className="absolute left-3 top-3 text-gray-400" size={20} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search anything..."
            className="w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex gap-4 mb-8">
        <button className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50">
          <Filter size={18} />
          Filters
        </button>
      </div>

      <div className="grid gap-4">
        {results.map((result) => (
          <div key={result.id} className="p-4 border rounded-lg hover:shadow-md cursor-pointer">
            <h3 className="font-semibold text-lg">{result.title}</h3>
            <p className="text-gray-600">{result.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SearchPage;