// /photos is an alias for /field-capture. Field photos and gallery photos
// are the same thing — both live on the dense Photos page (Tab S-Photos).
//
// Wire this in App.tsx as:
//   <Route path="/photos" element={<PhotosRedirect />} />

import React from 'react';
import { Navigate } from 'react-router-dom';

const PhotosRedirect: React.FC = () => <Navigate to="/field-capture" replace />;

export { PhotosRedirect };
export default PhotosRedirect;
