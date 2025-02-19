export interface Database {
  public: {
    Tables: {
      items: {
        Row: {
          id: number;
          name: string;
          description: string | null;
          purchase_price: number | null;
          selling_price: number | null;
          status: string;
          photo_storage_url: string | null;
          container_id: number | null;
          category_id: number | null;
          qr_code: string | null;
          user_id: string;
          deleted: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['items']['Row'], 'id'>;
        Update: Partial<Database['public']['Tables']['items']['Row']>;
      };
      containers: {
        Row: {
          id: number;
          name: string;
          description: string | null;
          number: string | null;
          qr_code: string | null;
          user_id: string;
          deleted: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['containers']['Row'], 'id'>;
        Update: Partial<Database['public']['Tables']['containers']['Row']>;
      };
      categories: {
        Row: {
          id: number;
          name: string;
          description: string | null;
          user_id: string;
          deleted: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['categories']['Row'], 'id'>;
        Update: Partial<Database['public']['Tables']['categories']['Row']>;
      };
      audit_logs: {
        Row: {
          id: number;
          table_name: string;
          operation: 'INSERT' | 'UPDATE' | 'DELETE';
          record_id: number;
          changes: any;
          user_id: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['audit_logs']['Row'], 'id'>;
        Update: Partial<Database['public']['Tables']['audit_logs']['Row']>;
      };
    };
    Views: {
      items_list: {
        Row: {
          id: number;
          name: string;
          status: string;
          selling_price: number | null;
          purchase_price: number | null;
          category_id: number | null;
          container_id: number | null;
          photo_storage_url: string | null;
          qr_code: string | null;
          created_at: string;
          updated_at: string;
        };
      };
    };
    Functions: {
      cleanup_old_audit_logs: {
        Args: Record<string, never>;
        Returns: void;
      };
      cleanup_unused_images: {
        Args: Record<string, never>;
        Returns: void;
      };
    };
  };
} 