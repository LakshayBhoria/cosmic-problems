import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Heart, MessageCircle, UserPlus, BellOff } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import api, { mediaUrl } from '../api';

const ICONS = { like: Heart, comment: MessageCircle, follow: UserPlus, follow_request: UserPlus };
const TEXT = {
  like: 'liked your problem',
  comment: 'commented on your problem',
  follow: 'started following you',
  follow_request: 'requested to follow you',
};

export default function Notifications() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/notifications').then(({ data }) => { setItems(data.notifications); setLoading(false); });
    api.put('/notifications/read-all');
  }, []);

  return (
    <div className="max-w-lg mx-auto px-3 pt-4 pb-8">
      <h1 className="font-display text-lg font-semibold mb-4 px-1">Notifications</h1>

      {loading && <div className="flex justify-center py-16"><div className="w-6 h-6 rounded-full border-2 border-nebula-violet border-t-transparent animate-spin" /></div>}

      {!loading && items.length === 0 && (
        <div className="text-center py-16">
          <BellOff size={28} className="mx-auto text-nebula-muted mb-2" />
          <p className="text-sm text-nebula-muted">Nothing yet. Activity on your problems will show up here.</p>
        </div>
      )}

      <div className="space-y-0.5">
        {items.map((n) => {
          const Icon = ICONS[n.type] || Heart;
          const content = (
            <div className={`flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-nebula-surface ${!n.is_read ? 'bg-nebula-violet/5' : ''}`}>
              <div className="relative shrink-0">
                <div className="w-10 h-10 rounded-full bg-nebula-surface border border-nebula-border overflow-hidden flex items-center justify-center">
                  {n.actor_avatar ? <img src={mediaUrl(n.actor_avatar)} className="w-full h-full object-cover" /> : <span className="text-sm font-display">{n.actor_username[0].toUpperCase()}</span>}
                </div>
                <span className="absolute -bottom-1 -right-1 bg-nebula-bg rounded-full p-0.5">
                  <Icon size={12} className={n.type === 'like' ? 'text-nebula-pink' : n.type.includes('follow') ? 'text-nebula-violet' : 'text-nebula-cyan'} />
                </span>
              </div>
              <p className="text-sm flex-1">
                <span className="font-medium">{n.actor_username}</span> {TEXT[n.type] || n.type}
                <span className="text-nebula-muted"> · {formatDistanceToNowStrict(new Date(n.created_at))} ago</span>
              </p>
            </div>
          );
          return n.post_id ? (
            <Link key={n.id} to={`/post/${n.post_id}`}>{content}</Link>
          ) : (
            <Link key={n.id} to={`/${n.actor_username}`}>{content}</Link>
          );
        })}
      </div>
    </div>
  );
}
