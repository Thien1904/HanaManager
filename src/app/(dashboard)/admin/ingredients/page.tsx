//src/app/(dashboard)/admin/ingredients/page.tsx
import IngredientsManager from '@/components/admin/IngredientsManager'
export const metadata = { title: 'Quản lý nguyên liệu' }
export default function IngredientsPage() {
  return <IngredientsManager />
  
}


// This file is the main page for the inventory management section in the admin dashboard. It imports and renders the InventoryManager component, which contains the logic for displaying and managing inventory items.
// ============================================================
// The InventoryManager component is responsible for fetching the inventory data using the useInventory hook, displaying the list of inventory items, and providing a button to open a modal for adding new inventory items. The InventoryFormModal component is used to handle the form submission for adding new items to the inventory.
// The useInventory hook is responsible for fetching the inventory data from the API and managing the loading and error states. It provides a refresh function that can be called to re-fetch the inventory data after adding or updating items.
// The API routes defined in src/api/inventory/route.ts handle the GET, POST, and PUT requests for managing the inventory data in the database. The GET route retrieves the list of inventory items, the POST route adds a new item to the inventory, and the PUT route updates an existing item. Each route checks for the appropriate user roles before allowing access to the functionality.
// Overall, this structure allows for a clean separation of concerns, with the page component handling the layout, the manager component handling the business logic, the form modal handling user input, and the API routes handling data persistence.
// This modular approach makes it easier to maintain and extend the functionality in the future.
// ============================================================
// Note: The actual implementation of the InventoryManager, InventoryFormModal, and useInventory hook would need to be completed for this page to function properly. The provided code snippets are just the structure and imports for the page component.
// src/app/(dashboard)/admin/staff/page.tsx
