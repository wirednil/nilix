# RADU Permission Pattern Documentation

## Overview

RADU (Read-Add-Delete-Update) is a granular permission control pattern that provides a simple yet powerful way to manage access rights in software systems. Originally developed in banking mainframe environments, RADU offers an intuitive approach to permission management that can be applied across modern software architectures.

## Core Concept

RADU represents the four fundamental operations that can be performed on any data resource:

- **R** - **Read**: Permission to view/retrieve data
- **A** - **Add**: Permission to create new data
- **D** - **Delete**: Permission to remove existing data  
- **U** - **Update**: Permission to modify existing data

## Permission Dependencies

RADU implements logical dependencies between operations:

```
Delete → Read (Cannot delete what you cannot see)
Update → Read (Cannot modify what you cannot see)
Add → Independent (Can create without reading existing data)
Read → Independent (Base permission level)
```

## Format Specifications

### Text Format (Human-Readable)
```
"RADU" = All permissions
"R   " = Read only
"RA  " = Read + Add
"RD  " = Read + Delete (Read auto-granted)
"RU  " = Read + Update (Read auto-granted)
"RAU " = Read + Add + Update
"RAD " = Read + Add + Delete
"RDU " = Read + Delete + Update
"A   " = Add only
"D   " = Delete only (Read auto-granted → "RD")
"U   " = Update only (Read auto-granted → "RU")
"    " = No permissions
```

### Binary Format (System Storage)
```
Position: [0][1][2][3]
Meaning:  [R][A][D][U]
Values:   Y/N for each position

"YYYY" = All permissions
"YNNN" = Read only
"YYNN" = Read + Add
"YNYN" = Read + Delete
"YNNY" = Read + Update
"    " = No permissions
```

## Implementation Patterns

### 1. Basic RADU Class

```python
class RADUPermissions:
    def __init__(self, radu_string=""):
        self.read = False
        self.add = False
        self.delete = False
        self.update = False
        self.parse_radu(radu_string)
    
    def parse_radu(self, radu_string):
        radu = radu_string.upper().ljust(4)
        
        # Basic permissions
        self.read = 'R' in radu
        self.add = 'A' in radu
        self.delete = 'D' in radu
        self.update = 'U' in radu
        
        # Auto-grant read for delete/update
        if self.delete or self.update:
            self.read = True
    
    def to_binary(self):
        return "".join([
            'Y' if self.read else 'N',
            'Y' if self.add else 'N', 
            'Y' if self.delete else 'N',
            'Y' if self.update else 'N'
        ])
    
    def to_radu(self):
        result = ""
        if self.read and not (self.delete or self.update):
            result += "R"
        if self.add:
            result += "A"
        if self.delete:
            result += "D"
        if self.update:
            result += "U"
        return result.ljust(4)
    
    def can_perform(self, operation):
        operations = {
            'read': self.read,
            'add': self.add,
            'delete': self.delete,
            'update': self.update,
            'get': self.read,
            'post': self.add,
            'put': self.update,
            'patch': self.update
        }
        return operations.get(operation.lower(), False)
```

### 2. Database Schema Design

```sql
-- User permissions table with RADU
CREATE TABLE user_permissions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    resource_type VARCHAR(50),
    resource_id VARCHAR(100),
    radu_permissions CHAR(4) DEFAULT '    ',
    granted_by INTEGER REFERENCES users(id),
    granted_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,
    
    INDEX idx_user_resource (user_id, resource_type, resource_id),
    INDEX idx_radu_perms (radu_permissions)
);

-- Example queries
-- Grant read-only access
UPDATE user_permissions 
SET radu_permissions = 'R   ' 
WHERE user_id = 123 AND resource_type = 'documents';

-- Grant full access
UPDATE user_permissions 
SET radu_permissions = 'RADU' 
WHERE user_id = 456 AND resource_type = 'admin_panel';

-- Check if user can delete
SELECT COUNT(*) > 0 as can_delete
FROM user_permissions 
WHERE user_id = 123 
  AND resource_type = 'files'
  AND (radu_permissions LIKE '%D%' OR radu_permissions LIKE 'RADU');
```

### 3. REST API Integration

```javascript
// Express.js middleware
const raduMiddleware = (requiredPermission) => {
    return async (req, res, next) => {
        try {
            const userId = req.user.id;
            const resource = req.params.resource || req.body.resource;
            
            // Get user permissions from database
            const userPerms = await getUserPermissions(userId, resource);
            const radu = new RADUPermissions(userPerms);
            
            // Map HTTP methods to RADU operations
            const methodMap = {
                'GET': 'read',
                'POST': 'add', 
                'PUT': 'update',
                'PATCH': 'update',
                'DELETE': 'delete'
            };
            
            const requiredOp = methodMap[req.method];
            
            if (!radu.can_perform(requiredOp)) {
                return res.status(403).json({
                    error: 'Insufficient permissions',
                    required: requiredOp,
                    current: radu.to_radu().trim()
                });
            }
            
            // Attach permissions to request for further use
            req.permissions = radu;
            next();
            
        } catch (error) {
            res.status(500).json({error: 'Permission check failed'});
        }
    };
};

// Usage in routes
app.get('/api/documents/:id', raduMiddleware('read'), getDocument);
app.post('/api/documents', raduMiddleware('add'), createDocument);
app.put('/api/documents/:id', raduMiddleware('update'), updateDocument);
app.delete('/api/documents/:id', raduMiddleware('delete'), deleteDocument);
```

### 4. Frontend Component Integration

```tsx
// React component with RADU guards
interface RADUGuardProps {
    permissions: string;
    operation: 'read' | 'add' | 'update' | 'delete';
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

export const RADUGuard: React.FC<RADUGuardProps> = ({
    permissions,
    operation,
    children,
    fallback = <div>Access Denied</div>
}) => {
    const radu = new RADUPermissions(permissions);
    
    if (!radu.can_perform(operation)) {
        return <>{fallback}</>;
    }
    
    return <>{children}</>;
};

// Usage example
export const DocumentManager: React.FC<{userPermissions: string}> = ({userPermissions}) => {
    return (
        <div>
            <RADUGuard permissions={userPermissions} operation="read">
                <DocumentList />
            </RADUGuard>
            
            <div className="actions">
                <RADUGuard permissions={userPermissions} operation="add">
                    <Button onClick={createDocument}>Create New</Button>
                </RADUGuard>
                
                <RADUGuard permissions={userPermissions} operation="update">
                    <Button onClick={editDocument}>Edit</Button>
                </RADUGuard>
                
                <RADUGuard permissions={userPermissions} operation="delete">
                    <Button onClick={deleteDocument} variant="danger">Delete</Button>
                </RADUGuard>
            </div>
        </div>
    );
};
```

## Advanced Use Cases

### 1. Role-Based Access Control (RBAC)

```yaml
# roles.yml
roles:
  admin:
    permissions:
      users: "RADU"
      documents: "RADU" 
      settings: "RADU"
      
  editor:
    permissions:
      documents: "RAU "
      users: "R   "
      settings: "R   "
      
  viewer:
    permissions:
      documents: "R   "
      users: "R   "
      settings: "    "
      
  contributor:
    permissions:
      documents: "RA  "
      users: "    "
      settings: "    "
```

### 2. Hierarchical Permissions

```python
class HierarchicalRADU:
    def __init__(self):
        self.permissions = {}
    
    def set_permission(self, path, radu):
        """Set permission for a specific resource path"""
        self.permissions[path] = RADUPermissions(radu)
    
    def get_effective_permission(self, path):
        """Get effective permission by checking path hierarchy"""
        # Check exact match first
        if path in self.permissions:
            return self.permissions[path]
        
        # Check parent paths (inherit permissions)
        parts = path.split('/')
        for i in range(len(parts) - 1, 0, -1):
            parent_path = '/'.join(parts[:i])
            if parent_path in self.permissions:
                return self.permissions[parent_path]
        
        # Default: no permissions
        return RADUPermissions()

# Example usage
hierarchy = HierarchicalRADU()
hierarchy.set_permission('/projects', 'R   ')  # Read-only for all projects
hierarchy.set_permission('/projects/secret', 'RADU')  # Full access to secret project
hierarchy.set_permission('/projects/public', 'RA  ')  # Read+Add for public projects

# Check permissions
can_edit_secret = hierarchy.get_effective_permission('/projects/secret/file.txt').update  # True
can_edit_public = hierarchy.get_effective_permission('/projects/public/file.txt').update  # False
```

### 3. Time-Based Permissions

```python
from datetime import datetime, timedelta

class TimedRADUPermissions(RADUPermissions):
    def __init__(self, radu_string="", valid_from=None, valid_until=None):
        super().__init__(radu_string)
        self.valid_from = valid_from or datetime.now()
        self.valid_until = valid_until
    
    def is_valid_now(self):
        now = datetime.now()
        if now < self.valid_from:
            return False
        if self.valid_until and now > self.valid_until:
            return False
        return True
    
    def can_perform(self, operation):
        if not self.is_valid_now():
            return False
        return super().can_perform(operation)

# Grant temporary admin access for 24 hours
temp_admin = TimedRADUPermissions(
    'RADU',
    valid_from=datetime.now(),
    valid_until=datetime.now() + timedelta(hours=24)
)
```

## Best Practices

### 1. Security Guidelines
- **Principle of Least Privilege**: Start with minimal permissions and add as needed
- **Regular Auditing**: Log all permission checks and changes
- **Explicit Dependencies**: Always auto-grant read when granting delete/update
- **Validation**: Validate RADU strings on input and storage

### 2. Performance Optimization
- **Caching**: Cache frequently-checked permissions
- **Indexing**: Index permission columns in databases
- **Batch Operations**: Check permissions in batches when possible

### 3. Monitoring and Logging

```python
import logging

class AuditedRADUPermissions(RADUPermissions):
    def __init__(self, radu_string="", user_id=None, resource_id=None):
        super().__init__(radu_string)
        self.user_id = user_id
        self.resource_id = resource_id
        self.logger = logging.getLogger('radu_audit')
    
    def can_perform(self, operation):
        result = super().can_perform(operation)
        
        # Log permission check
        self.logger.info({
            'user_id': self.user_id,
            'resource_id': self.resource_id,
            'operation': operation,
            'permissions': self.to_radu().strip(),
            'result': 'GRANTED' if result else 'DENIED',
            'timestamp': datetime.now().isoformat()
        })
        
        return result
```

## Migration Strategies

### From Complex ACL Systems
```python
def migrate_acl_to_radu(acl_permissions):
    """Convert complex ACL to simple RADU"""
    radu = ""
    
    if 'read' in acl_permissions or 'view' in acl_permissions:
        radu += "R"
    if 'create' in acl_permissions or 'write' in acl_permissions:
        radu += "A" 
    if 'delete' in acl_permissions:
        radu += "D"
    if 'edit' in acl_permissions or 'modify' in acl_permissions:
        radu += "U"
        
    return radu.ljust(4)
```

### From Role-Based to RADU
```sql
-- Migration script from roles to RADU
INSERT INTO user_permissions (user_id, resource_type, radu_permissions)
SELECT 
    ur.user_id,
    'documents',
    CASE ur.role_name
        WHEN 'admin' THEN 'RADU'
        WHEN 'editor' THEN 'RAU '
        WHEN 'contributor' THEN 'RA  '
        WHEN 'viewer' THEN 'R   '
        ELSE '    '
    END
FROM user_roles ur;
```

## Testing Patterns

```python
import pytest

class TestRADUPermissions:
    def test_read_only_permissions(self):
        radu = RADUPermissions("R   ")
        assert radu.can_perform('read') == True
        assert radu.can_perform('add') == False
        assert radu.can_perform('update') == False
        assert radu.can_perform('delete') == False
    
    def test_delete_implies_read(self):
        radu = RADUPermissions("D   ")
        assert radu.can_perform('read') == True
        assert radu.can_perform('delete') == True
        assert radu.can_perform('add') == False
        assert radu.can_perform('update') == False
    
    def test_update_implies_read(self):
        radu = RADUPermissions("U   ")
        assert radu.can_perform('read') == True
        assert radu.can_perform('update') == True
        assert radu.can_perform('add') == False
        assert radu.can_perform('delete') == False
    
    def test_full_permissions(self):
        radu = RADUPermissions("RADU")
        assert all(radu.can_perform(op) for op in ['read', 'add', 'delete', 'update'])
    
    def test_binary_conversion(self):
        radu = RADUPermissions("RA  ")
        assert radu.to_binary() == "YYNN"
        
    def test_radu_string_conversion(self):
        radu = RADUPermissions("RA  ")
        assert radu.to_radu().strip() == "RA"
```

## Conclusion

The RADU permission pattern provides a simple, intuitive, and powerful approach to access control that scales from simple applications to complex enterprise systems. Its strength lies in its simplicity - four operations that cover the vast majority of permission scenarios while maintaining logical consistency through automatic dependency resolution.

The pattern's origins in banking mainframe systems demonstrate its robustness and suitability for mission-critical applications, while its simplicity makes it easily adoptable in modern software architectures across web applications, APIs, mobile apps, and cloud services.

## References

- Original implementation in Banking Application Utilities (BAUTILS)
- TAL (Transaction Application Language) on HP NonStop systems
- ISO banking standards for permission management
- PCI DSS compliance requirements for financial systems