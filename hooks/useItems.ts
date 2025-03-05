import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Item } from '../lib/supabase';
import { useAuth } from './useAuth';

export function useItems(userId?: string | null) {
  const { userId: authUserId } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load items for a specific user or all available items
  useEffect(() => {
    async function loadItems() {
      try {
        let query = supabase.from('items').select('*');
        
        if (userId) {
          // Load items for a specific user
          query = query.eq('user_id', userId);
        } else if (authUserId) {
          // Load all available items except the current user's
          query = query
            .eq('is_available', true)
            .neq('user_id', authUserId);
        } else {
          // Load all available items (for non-authenticated users)
          query = query.eq('is_available', true);
        }
        
        const { data, error: fetchError } = await query.order('created_at', { ascending: false });
        
        if (fetchError) throw fetchError;
        
        setItems(data || []);
      } catch (err) {
        console.error('Error loading items:', err);
        setError('Failed to load items');
      } finally {
        setLoading(false);
      }
    }

    loadItems();
  }, [userId, authUserId]);

  // Add a new item
  const addItem = async (item: Omit<Item, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'is_available'>) => {
    if (!authUserId) return { success: false, error: 'User not authenticated' };

    try {
      const newItem = {
        ...item,
        user_id: authUserId,
        is_available: true,
      };

      const { data, error } = await supabase
        .from('items')
        .insert(newItem)
        .select()
        .single();

      if (error) throw error;

      setItems(prev => [data, ...prev]);
      return { success: true, item: data };
    } catch (err) {
      console.error('Error adding item:', err);
      return { success: false, error: 'Failed to add item' };
    }
  };

  // Update an existing item
  const updateItem = async (id: string, updates: Partial<Item>) => {
    if (!authUserId) return { success: false, error: 'User not authenticated' };

    try {
      const { data, error } = await supabase
        .from('items')
        .update(updates)
        .eq('id', id)
        .eq('user_id', authUserId) // Ensure user owns the item
        .select()
        .single();

      if (error) throw error;

      setItems(prev => prev.map(item => item.id === id ? data : item));
      return { success: true, item: data };
    } catch (err) {
      console.error('Error updating item:', err);
      return { success: false, error: 'Failed to update item' };
    }
  };

  // Delete an item
  const deleteItem = async (id: string) => {
    if (!authUserId) return { success: false, error: 'User not authenticated' };

    try {
      const { error } = await supabase
        .from('items')
        .delete()
        .eq('id', id)
        .eq('user_id', authUserId); // Ensure user owns the item

      if (error) throw error;

      setItems(prev => prev.filter(item => item.id !== id));
      return { success: true };
    } catch (err) {
      console.error('Error deleting item:', err);
      return { success: false, error: 'Failed to delete item' };
    }
  };

  return {
    items,
    loading,
    error,
    addItem,
    updateItem,
    deleteItem,
  };
}