// StoragePhoto — <img> wrapper that resolves a Supabase Storage path or
// legacy /public/ URL into a signed URL and renders a Camera placeholder
// while loading, on error, or when the path is missing. Centralizes the
// onError fallback so individual call sites don't have to repeat it.

import React from 'react';
import { Camera } from 'lucide-react';
import { useSignedStorageUrl } from '../../hooks/useSignedStorageUrl';
import { colors } from '../../styles/theme';

export interface StoragePhotoProps {
  bucket: string;
  pathOrUrl: string | null | undefined;
  alt?: string;
  loading?: 'lazy' | 'eager';
  style?: React.CSSProperties;
  className?: string;
  iconSize?: number;
}

export const StoragePhoto: React.FC<StoragePhotoProps> = React.memo(
  ({ bucket, pathOrUrl, alt, loading = 'lazy', style, className, iconSize = 20 }) => {
    const { url, loading: resolving, error } = useSignedStorageUrl(bucket, pathOrUrl);
    const [imgFailed, setImgFailed] = React.useState(false);

    React.useEffect(() => {
      setImgFailed(false);
    }, [url]);

    const showPlaceholder = !url || resolving || error || imgFailed;

    if (showPlaceholder) {
      return (
        <div
          aria-label={alt ?? 'Photo unavailable'}
          role="img"
          className={className}
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surfaceInset,
            color: colors.textTertiary,
            ...style,
          }}
        >
          <Camera size={iconSize} />
        </div>
      );
    }

    return (
      <img
        src={url}
        alt={alt ?? ''}
        loading={loading}
        onError={() => setImgFailed(true)}
        className={className}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
          ...style,
        }}
      />
    );
  },
);
StoragePhoto.displayName = 'StoragePhoto';
