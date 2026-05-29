@extends('layouts.gynx-admin')

@section('title', 'Partner Modpacks')
@section('header-title', 'Partner Modpacks')
@section('header-sub', 'Featured modpacks shown at the top of the in-panel installer.')

@section('content')
    <div class="alert alert--info">
        <strong>How these work.</strong>
        Each entry is a curated pointer into the existing modpack installer. Set the <strong>provider</strong> and
        its <strong>project / external ID</strong> (optionally a specific version and game version) and the user's
        normal install pipeline runs when they hit <em>Install</em>. Only <strong>visible</strong> packs whose
        provider supports the player's game appear in the installer; <strong>featured</strong> packs are highlighted
        and sorted first. Banners use an image <strong>URL</strong> (host on your CDN — same as the branding logo).
    </div>

    {{-- ----------------------------------------------------------------
         Add a new partner modpack
    ---------------------------------------------------------------- --}}
    <div class="card">
        <div class="card__header">
            <h3 class="card__title">Add a partner modpack</h3>
        </div>
        <div class="card__body">
            <form action="{{ route('admin.partner-modpacks.store') }}" method="POST">
                {{ csrf_field() }}
                @include('admin.partner-modpacks._fields', ['pack' => null, 'sources' => $sources])
                <button type="submit" class="btn btn--primary"><i class="fa fa-plus"></i> Add modpack</button>
            </form>
        </div>
    </div>

    {{-- ----------------------------------------------------------------
         Existing partner modpacks
    ---------------------------------------------------------------- --}}
    @if($packs->isEmpty())
        <div class="card">
            <div class="card__body">
                <p class="card__intro" style="margin:0">No partner modpacks yet. Add one above and it will appear at the top of the installer's Modpacks tab.</p>
            </div>
        </div>
    @else
        @foreach($packs as $pack)
            <div class="card">
                <div class="card__header">
                    <h3 class="card__title">
                        {{ $pack->title }}
                        <small style="opacity:.6">{{ $pack->source }} · {{ $pack->external_id }}</small>
                    </h3>
                    <div>
                        @if($pack->is_featured)
                            <span class="pill pill--success"><span class="pill__dot"></span>featured</span>
                        @endif
                        @if($pack->is_visible)
                            <span class="pill pill--info"><span class="pill__dot"></span>visible</span>
                        @else
                            <span class="pill">hidden</span>
                        @endif
                    </div>
                </div>
                <div class="card__body">
                    <form action="{{ route('admin.partner-modpacks.update', $pack->id) }}" method="POST">
                        {{ csrf_field() }}
                        @include('admin.partner-modpacks._fields', ['pack' => $pack, 'sources' => $sources])
                        <button type="submit" class="btn btn--primary"><i class="fa fa-save"></i> Save changes</button>
                    </form>

                    <form action="{{ route('admin.partner-modpacks.destroy', $pack->id) }}" method="POST"
                          style="margin-top:10px;"
                          onsubmit="return confirm('Remove “{{ $pack->title }}” from the installer? This cannot be undone.')">
                        {{ csrf_field() }}
                        {{ method_field('DELETE') }}
                        <button type="submit" class="btn btn--ghost"><i class="fa fa-trash-o"></i> Remove</button>
                    </form>
                </div>
            </div>
        @endforeach
    @endif
@endsection
