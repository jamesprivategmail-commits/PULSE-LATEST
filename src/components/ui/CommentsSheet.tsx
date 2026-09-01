import React, { useState } from 'react';
import { Send, Heart } from 'lucide-react';

interface Comment {
  id: number;
  author: string;
  text: string;
  likes: number;
  timestamp: string;
}

interface CommentsSheetProps {
  postId: string;
  onClose?: () => void;
}

const CommentsSheet: React.FC<CommentsSheetProps> = ({ postId, onClose }) => {
  const [comments, setComments] = useState<Comment[]>([
    { id: 1, author: 'John', text: 'Great post!', likes: 5, timestamp: '2 hours ago' },
    { id: 2, author: 'Jane', text: 'Love this!', likes: 12, timestamp: '1 hour ago' },
  ]);
  const [newComment, setNewComment] = useState('');

  const handleAddComment = () => {
    if (newComment.trim()) {
      setComments([...comments, {
        id: comments.length + 1,
        author: 'You',
        text: newComment,
        likes: 0,
        timestamp: 'just now',
      }]);
      setNewComment('');
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg">
      <div className="p-4 border-b">
        <h2 className="text-xl font-bold">Comments</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {comments.map((comment) => (
          <div key={comment.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-semibold">{comment.author}</p>
              <p className="text-sm text-gray-500">{comment.timestamp}</p>
            </div>
            <p className="text-gray-700">{comment.text}</p>
            <div className="flex items-center gap-2 text-gray-500">
              <Heart size={16} />
              <span className="text-sm">{comment.likes} likes</span>
            </div>
          </div>
        ))}
      </div>
      <div className="p-4 border-t flex gap-2">
        <input
          type="text"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleAddComment}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
};

export default CommentsSheet;