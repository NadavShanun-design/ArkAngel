import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  User,
  Mail,
  Calendar,
  Clock,
  Edit3,
  Save,
  X,
  Phone,
  Shield,
  LogOut
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { invoke } from '@tauri-apps/api/core';

export const ProfilePage: React.FC = () => {
  const { user, logout, updateUserProfile, isLoading, isAuthenticated } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    full_name: user?.full_name || '',
    phone: user?.phone || '',
    avatar_url: user?.avatar_url || '',
  });

  const handleEdit = () => {
    setEditData({
      full_name: user?.full_name || '',
      phone: user?.phone || '',
      avatar_url: user?.avatar_url || '',
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    try {
      await updateUserProfile(editData);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update profile:', error);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditData({
      full_name: user?.full_name || '',
      phone: user?.phone || '',
      avatar_url: user?.avatar_url || '',
    });
  };

  const handleLogout = async () => {
    await logout();
    // Refresh the page to show the sign-in prompt
    window.location.reload();
  };

  const handleAuthClick = async () => {
    try {
      await invoke('open_auth_window');
    } catch (error) {
      console.error('Failed to open auth window:', error);
    }
  };

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-lg border border-gray-200">
          <CardHeader className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-black rounded-xl flex items-center justify-center shadow-md">
              <span className="text-2xl font-bold text-white">A</span>
            </div>
            <CardTitle className="text-2xl font-bold text-black">Sign in to view your profile</CardTitle>
            <CardDescription className="text-gray-500">
              Please sign in to view your profile
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-sm text-gray-500">
              Your personal information and account details.
            </p>
            <Button
              onClick={handleAuthClick}
              className="w-full bg-black text-white hover:bg-gray-800"
            >
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getInitials = () => {
    if (user?.full_name) {
      const names = user.full_name.split(' ');
      return names.length > 1
        ? `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase()
        : names[0][0].toUpperCase();
    }
    return user?.email?.[0]?.toUpperCase() || 'U';
  };

  return (
    <div className="min-h-screen bg-white p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center py-8">
          <h1 className="text-4xl font-bold text-black mb-2">Profile & Account</h1>
          <p className="text-gray-500">Manage your personal information and preferences</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Card */}
          <Card className="lg:col-span-1 border border-gray-200">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <Avatar className="w-24 h-24">
                  <AvatarImage src={user.avatar_url} alt={user.full_name} />
                  <AvatarFallback className="text-2xl bg-black text-white">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
              </div>
              <CardTitle className="text-xl text-black">{user.full_name || 'User'}</CardTitle>
              <CardDescription className="text-gray-500">{user.email}</CardDescription>
              <Badge variant="secondary" className="mt-2 bg-gray-100 text-black">
                <Shield className="w-3 h-3 mr-1" />
                Active User
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center text-sm text-gray-600">
                  <Mail className="w-4 h-4 mr-2" />
                  {user.email}
                </div>
                {user.phone && (
                  <div className="flex items-center text-sm text-gray-600">
                    <Phone className="w-4 h-4 mr-2" />
                    {user.phone}
                  </div>
                )}
                <div className="flex items-center text-sm text-gray-600">
                  <Calendar className="w-4 h-4 mr-2" />
                  Joined {new Date(user.created_at).toLocaleDateString()}
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <Clock className="w-4 h-4 mr-2" />
                  Last updated {new Date(user.updated_at).toLocaleDateString()}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Personal Information */}
            <Card className="border border-gray-200">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center text-black">
                      <User className="w-5 h-5 mr-2" />
                      Personal Information
                    </CardTitle>
                    <CardDescription className="text-gray-500">
                      Update your personal details
                    </CardDescription>
                  </div>
                  {!isEditing && (
                    <Button variant="outline" size="sm" onClick={handleEdit} className="border-gray-300 text-black hover:bg-gray-100">
                      <Edit3 className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {isEditing ? (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="full_name" className="text-black">Full Name</Label>
                      <Input
                        id="full_name"
                        value={editData.full_name}
                        onChange={(e) => setEditData(prev => ({ ...prev, full_name: e.target.value }))}
                        className="border-gray-300 focus:border-black focus:ring-black"
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone" className="text-black">Phone Number</Label>
                      <Input
                        id="phone"
                        value={editData.phone}
                        onChange={(e) => setEditData(prev => ({ ...prev, phone: e.target.value }))}
                        className="border-gray-300 focus:border-black focus:ring-black"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleSave} disabled={isLoading} className="bg-black text-white hover:bg-gray-800">
                        <Save className="w-4 h-4 mr-1" />
                        Save Changes
                      </Button>
                      <Button variant="outline" onClick={handleCancel} className="border-gray-300 text-black hover:bg-gray-100">
                        <X className="w-4 h-4 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Full Name</Label>
                      <p className="text-lg text-black">{user.full_name || 'Not set'}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Email</Label>
                      <p className="text-lg text-black">{user.email}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Phone</Label>
                      <p className="text-lg text-black">{user.phone || 'Not set'}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Account Actions */}
            <Card className="border border-gray-200">
              <CardHeader>
                <CardTitle className="flex items-center text-black">
                  <Shield className="w-5 h-5 mr-2" />
                  Account Actions
                </CardTitle>
                <CardDescription className="text-gray-500">
                  Manage your account settings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div>
                      <h4 className="font-medium text-black">Sign Out</h4>
                      <p className="text-sm text-gray-500">Sign out of your account on this device</p>
                    </div>
                    <Button variant="outline" onClick={handleLogout} className="border-gray-300 text-black hover:bg-gray-100">
                      <LogOut className="w-4 h-4 mr-1" />
                      Sign Out
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
