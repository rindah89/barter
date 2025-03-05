import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Review } from '../lib/supabase';
import { useAuth } from './useAuth';

export type ReviewWithReviewer = Review & {
  reviewer: {
    name: string;
    avatar_url: string;
  };
};

export function useReviews(userId?: string | null) {
  const { userId: authUserId } = useAuth();
  const profileId = userId || authUserId;
  
  const [reviews, setReviews] = useState<ReviewWithReviewer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profileId) {
      setLoading(false);
      return;
    }

    async function loadReviews() {
      try {
        const { data, error: fetchError } = await supabase
          .from('reviews')
          .select(`
            *,
            reviewer:reviewer_id(name, avatar_url)
          `)
          .eq('reviewed_id', profileId)
          .order('created_at', { ascending: false });

        if (fetchError) throw fetchError;
        
        setReviews(data || []);
      } catch (err) {
        console.error('Error loading reviews:', err);
        setError('Failed to load reviews');
      } finally {
        setLoading(false);
      }
    }

    loadReviews();
  }, [profileId]);

  // Create a new review
  const createReview = async (tradeId: string, reviewedId: string, rating: number, comment?: string) => {
    if (!authUserId) return { success: false, error: 'User not authenticated' };

    try {
      const newReview = {
        trade_id: tradeId,
        reviewer_id: authUserId,
        reviewed_id: reviewedId,
        rating,
        comment,
      };

      const { data, error } = await supabase
        .from('reviews')
        .insert(newReview)
        .select(`
          *,
          reviewer:reviewer_id(name, avatar_url)
        `)
        .single();

      if (error) throw error;

      if (reviewedId === profileId) {
        setReviews(prev => [data, ...prev]);
      }
      
      return { success: true, review: data };
    } catch (err) {
      console.error('Error creating review:', err);
      return { success: false, error: 'Failed to create review' };
    }
  };

  return {
    reviews,
    loading,
    error,
    createReview,
  };
}