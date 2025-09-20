# Firebase Firestore Index Setup

## Required Index for Adventure Images

To fix the cover image loading issue and optimize performance, you need to create a composite index in Firebase Firestore.

### Quick Fix (Recommended)

1. **Click the direct link from the error message in your browser console:**
   ```
   https://console.firebase.google.com/v1/r/project/litkraft-8d090/firestore/indexes?create_composite=...
   ```
   
   This link is automatically generated when the query fails and will pre-populate all the correct settings.

### Manual Setup (Alternative)

If the link doesn't work, follow these steps:

1. **Go to Firebase Console:**
   ```
   https://console.firebase.google.com/project/litkraft-8d090/firestore/indexes
   ```

2. **Click "Create Index"**

3. **Configure the index:**
   - **Collection ID**: `adventureImages`
   - **Fields to index**:
     - Field: `userId`, Order: `Ascending`
     - Field: `timestamp`, Order: `Descending`
   - **Query scopes**: Collection
   
4. **Click "Create"**

5. **Wait for index to build** (usually takes a few minutes)

### Why This Index is Needed

The app queries adventure images with:
```typescript
query(
  collection(db, 'adventureImages'),
  where('userId', '==', userId),        // Filter by user
  orderBy('timestamp', 'desc'),         // Sort by timestamp (latest first)
  limit(100)                           // Limit results
)
```

Firebase requires a composite index for queries that combine `where()` and `orderBy()` on different fields.

### Current Status

✅ **Fallback query implemented** - The app now works without the index using client-side sorting
⚠️ **Performance impact** - Without the index, queries are slower and less efficient
🎯 **Recommended** - Create the index for optimal performance

### After Creating the Index

1. The app will automatically use the optimized query
2. You'll see this message in console: `🖼️ Successfully fetched X adventure cover images via optimized query`
3. Cover images will load faster
4. Better performance with large numbers of images

---

**Note**: The app continues to work without the index thanks to the fallback implementation, but creating the index will significantly improve performance.
