@extends('layouts.gynx-admin')

@section('title', 'Users')
@section('header-title', 'Users')
@section('header-sub', 'All registered users on the system.')

@section('content')
    <div class="card">
        <div class="card__header">
            <h3 class="card__title">User list</h3>
            <form action="{{ route('admin.users') }}" method="GET" class="search-form">
                <input type="text" name="filter[email]"
                       value="{{ request()->input('filter.email') }}"
                       placeholder="Search by email">
                <button type="submit" class="btn btn--ghost btn--sm">
                    <i class="fa fa-search"></i>
                </button>
                <a href="{{ route('admin.users.new') }}" class="btn btn--primary btn--sm">Create new</a>
            </form>
        </div>
        <div class="card__body" style="padding: 0;">
            <div class="table-wrap" style="border: 0; border-radius: 0;">
                <table class="table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th></th>
                            <th>Email</th>
                            <th>Client name</th>
                            <th>Username</th>
                            <th>2FA</th>
                            <th title="Servers this user owns">Owned</th>
                            <th title="Servers this user is a subuser of">Access</th>
                        </tr>
                    </thead>
                    <tbody>
                        @forelse($users as $user)
                            <tr>
                                <td><code>{{ $user->id }}</code></td>
                                <td style="width: 1%;">
                                    <img src="https://www.gravatar.com/avatar/{{ md5(strtolower($user->email)) }}?s=48"
                                         alt="" style="width: 24px; height: 24px; border-radius: 50%; display:block;">
                                </td>
                                <td>
                                    <a href="{{ route('admin.users.view', $user->id) }}">{{ $user->email }}</a>
                                    @if($user->root_admin)
                                        <span class="pill pill--warning" title="Administrator" style="margin-left: 6px;">admin</span>
                                    @endif
                                </td>
                                <td>{{ $user->name_last }}, {{ $user->name_first }}</td>
                                <td>{{ $user->username }}</td>
                                <td>
                                    @if($user->use_totp)
                                        <span class="pill pill--success"><span class="pill__dot"></span>on</span>
                                    @else
                                        <span class="pill pill--danger">off</span>
                                    @endif
                                </td>
                                <td>
                                    <a href="{{ route('admin.servers', ['filter[owner_id]' => $user->id]) }}">{{ $user->servers_count }}</a>
                                </td>
                                <td>{{ $user->subuser_of_count }}</td>
                            </tr>
                        @empty
                            <tr>
                                <td colspan="8" class="table-empty">No users match.</td>
                            </tr>
                        @endforelse
                    </tbody>
                </table>
            </div>
            @if($users->hasPages())
                <div style="padding: 8px 18px 16px;">
                    {!! $users->appends(['query' => Request::input('query')])->render() !!}
                </div>
            @endif
        </div>
    </div>
@endsection
