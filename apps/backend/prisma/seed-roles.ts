import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// System role definitions
const SYSTEM_ROLES = [
  { name: 'BUYER', label: 'Buyer', description: 'Default buyer role — can browse and purchase products', color: '#3B82F6', icon: 'shopping-bag' },
  { name: 'VENDOR', label: 'Vendor', description: 'Vendor/supplier role — can list and manage their own products', color: '#8B5CF6', icon: 'store' },
  { name: 'DISTRIBUTOR', label: 'Distributor', description: 'Distributor role — gets distributor-level pricing', color: '#F59E0B', icon: 'truck' },
  { name: 'ADMIN', label: 'Admin', description: 'System administrator — full access to everything', color: '#EF4444', icon: 'shield' },
];

// Base permission definitions: action:resource
const BASE_PERMISSIONS = [
  // Buyer permissions
  { action: 'read', resource: 'products', description: 'View products and pricing' },
  { action: 'read', resource: 'orders', description: 'View own orders' },
  { action: 'write', resource: 'orders', description: 'Place and manage orders' },
  { action: 'read', resource: 'cart', description: 'View shopping cart' },
  { action: 'write', resource: 'cart', description: 'Modify shopping cart' },
  { action: 'write', resource: 'reviews', description: 'Write product reviews' },
  { action: 'read', resource: 'rfqs', description: 'View own RFQs' },
  { action: 'write', resource: 'rfqs', description: 'Create RFQs' },
  { action: 'read', resource: 'quotes', description: 'View quotes received' },

  // Vendor permissions
  { action: 'read', resource: 'own-products', description: 'View own products' },
  { action: 'write', resource: 'own-products', description: 'Create and edit own products' },
  { action: 'read', resource: 'own-orders', description: 'View orders for own products' },
  { action: 'update', resource: 'own-orders', description: 'Update order status for own products' },
  { action: 'write', resource: 'quotes', description: 'Create quotes for RFQs' },

  // Distributor permissions (inherits buyer + extra)
  { action: 'read', resource: 'distributor-pricing', description: 'View distributor-level pricing' },

  // Admin permissions
  { action: 'manage', resource: 'users', description: 'Full user management' },
  { action: 'manage', resource: 'products', description: 'Full product management' },
  { action: 'manage', resource: 'orders', description: 'Full order management' },
  { action: 'manage', resource: 'categories', description: 'Category management' },
  { action: 'manage', resource: 'inventory', description: 'Inventory management' },
  { action: 'manage', resource: 'pricing', description: 'Manage all pricing: tiers, contracts, role prices, discounts, coupons' },
  { action: 'manage', resource: 'roles', description: 'Role and permission management' },
  { action: 'manage', resource: 'settings', description: 'Site settings management' },
  { action: 'manage', resource: 'analytics', description: 'View all analytics' },
  { action: 'manage', resource: 'delivery', description: 'Delivery partner management' },
  { action: 'manage', resource: 'reviews', description: 'Moderate all reviews' },
  { action: 'manage', resource: 'returns', description: 'Process returns' },
  { action: 'manage', resource: 'notifications', description: 'Manage notifications' },
  { action: 'manage', resource: 'payments', description: 'Payment gateway management' },
  { action: 'manage', resource: 'loyalty', description: 'Loyalty program management' },
];

// Role-to-permission mapping (using action:resource keys)
const ROLE_PERMISSIONS: Record<string, string[]> = {
  BUYER: [
    'read:products', 'read:orders', 'write:orders', 'read:cart', 'write:cart', 'write:reviews',
    'read:rfqs', 'write:rfqs', 'read:quotes',
  ],
  VENDOR: [
    'read:products', 'read:orders', 'write:orders', 'read:cart', 'write:cart', 'write:reviews',
    'read:rfqs', 'write:rfqs', 'read:quotes',
    'read:own-products', 'write:own-products', 'read:own-orders', 'update:own-orders', 'write:quotes',
  ],
  DISTRIBUTOR: [
    'read:products', 'read:orders', 'write:orders', 'read:cart', 'write:cart', 'write:reviews',
    'read:rfqs', 'write:rfqs', 'read:quotes',
    'read:distributor-pricing',
  ],
  ADMIN: [
    'manage:users', 'manage:products', 'manage:orders', 'manage:categories',
    'manage:inventory', 'manage:pricing', 'manage:roles', 'manage:settings',
    'manage:analytics', 'manage:delivery', 'manage:reviews', 'manage:returns',
    'manage:notifications', 'manage:payments', 'manage:loyalty',
    'read:products', 'read:orders', 'write:orders', 'read:cart', 'write:cart',
  ],
};

async function main() {
  console.log('🌱 Seeding roles and permissions...');

  // 1. Create permissions
  const permissionMap: Record<string, string> = {};
  for (const perm of BASE_PERMISSIONS) {
    const key = `${perm.action}:${perm.resource}`;
    const record = await prisma.permission.upsert({
      where: { action_resource: { action: perm.action, resource: perm.resource } },
      update: { description: perm.description },
      create: {
        action: perm.action,
        resource: perm.resource,
        description: perm.description,
      },
    });
    permissionMap[key] = record.id;
  }
  console.log(`✅ Created ${Object.keys(permissionMap).length} permissions`);

  // 2. Create system roles
  const roleMap: Record<string, string> = {};
  for (const roleDef of SYSTEM_ROLES) {
    const record = await prisma.role.upsert({
      where: { name: roleDef.name },
      update: { label: roleDef.label, description: roleDef.description, color: roleDef.color, icon: roleDef.icon },
      create: {
        name: roleDef.name,
        label: roleDef.label,
        description: roleDef.description,
        isSystem: true,
        color: roleDef.color,
        icon: roleDef.icon,
      },
    });
    roleMap[roleDef.name] = record.id;
  }
  console.log(`✅ Created ${Object.keys(roleMap).length} system roles`);

  // 3. Assign permissions to roles
  for (const [roleName, permKeys] of Object.entries(ROLE_PERMISSIONS)) {
    const roleId = roleMap[roleName];
    if (!roleId) continue;

    for (const permKey of permKeys) {
      const permissionId = permissionMap[permKey];
      if (!permissionId) {
        console.warn(`⚠️  Permission "${permKey}" not found, skipping`);
        continue;
      }
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId } },
        update: {},
        create: { roleId, permissionId },
      });
    }
  }
  console.log('✅ Permissions assigned to roles');

  // 4. Backfill User.roleId based on existing User.role enum
  const users = await prisma.user.findMany({ select: { id: true, role: true } });
  let backfilled = 0;
  for (const user of users) {
    const roleId = roleMap[user.role as string];
    if (roleId) {
      await prisma.user.update({
        where: { id: user.id },
        data: { roleId },
      });
      backfilled++;
    }
  }
  console.log(`✅ Backfilled roleId for ${backfilled} users`);

  console.log('🌱 Roles & permissions seed complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });