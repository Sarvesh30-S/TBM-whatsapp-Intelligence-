package com.tbm.whatsapp.security;

import com.tbm.whatsapp.entity.User;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.time.Instant;
import java.util.Collection;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

public class UserPrincipal implements UserDetails {
    private final UUID id;
    private final String email;
    private final String passwordHash;
    private final String fullName;
    private final UUID departmentId;
    private final boolean active;
    private final Instant tokenInvalidBefore;
    private final Collection<? extends GrantedAuthority> authorities;

    public UserPrincipal(UUID id, String email, String passwordHash, String fullName, UUID departmentId,
                         boolean active, Instant tokenInvalidBefore, Collection<? extends GrantedAuthority> authorities) {
        this.id = id;
        this.email = email;
        this.passwordHash = passwordHash;
        this.fullName = fullName;
        this.departmentId = departmentId;
        this.active = active;
        this.tokenInvalidBefore = tokenInvalidBefore;
        this.authorities = authorities;
    }

    public static UserPrincipal create(User user) {
        Set<GrantedAuthority> authorities = new HashSet<>();
        if (user.getRoles() != null) {
            user.getRoles().forEach(role -> {
                authorities.add(new SimpleGrantedAuthority(role.getName()));
                if (role.getPermissions() != null) {
                    role.getPermissions().forEach(perm -> authorities.add(new SimpleGrantedAuthority(perm.getCode())));
                }
            });
        }

        return new UserPrincipal(
                user.getId(),
                user.getEmail(),
                user.getPasswordHash(),
                user.getFullName(),
                user.getDepartment() != null ? user.getDepartment().getId() : null,
                user.isActive(),
                user.getTokenInvalidBefore(),
                authorities
        );
    }

    public UUID getId() { return id; }
    public String getEmail() { return email; }
    public String getFullName() { return fullName; }
    public UUID getDepartmentId() { return departmentId; }
    public Instant getTokenInvalidBefore() { return tokenInvalidBefore; }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() { return authorities; }
    @Override
    public String getPassword() { return passwordHash; }
    @Override
    public String getUsername() { return email; }
    @Override
    public boolean isAccountNonExpired() { return true; }
    @Override
    public boolean isAccountNonLocked() { return active; }
    @Override
    public boolean isCredentialsNonExpired() { return true; }
    @Override
    public boolean isEnabled() { return active; }
}
